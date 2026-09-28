// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pact} from "../src/Pact.sol";

/// @dev A freelancer contract that tries to re-enter on payout.
contract GreedyFreelancer {
    Pact public pact;
    uint256 public dealId;
    uint256 public reentries;

    constructor(Pact p) {
        pact = p;
    }

    function setDeal(uint256 id) external {
        dealId = id;
    }

    function deliver() external {
        pact.markDelivered(dealId);
    }

    function claimIt() external {
        pact.claim(dealId);
    }

    receive() external payable {
        reentries++;
        // try to be paid twice; must fail
        try pact.claim(dealId) {} catch {}
        try pact.refund(dealId) {} catch {}
    }
}

/// @dev A recipient that refuses ETH.
contract Rejecter {
    function deliver(Pact p, uint256 id) external {
        p.markDelivered(id);
    }
}

contract PactTest is Test {
    Pact pact;
    address client = makeAddr("client");
    address freelancer = makeAddr("freelancer");
    address stranger = makeAddr("stranger");
    uint64 deadline;

    event DealCreated(
        uint256 indexed id,
        address indexed client,
        address indexed freelancer,
        uint256 amount,
        uint64 deadline,
        string title
    );
    event Delivered(uint256 indexed id, uint64 at);
    event Released(uint256 indexed id, address indexed to, uint256 amount, bool claimed);
    event Refunded(uint256 indexed id, address indexed to, uint256 amount);

    function setUp() public {
        pact = new Pact();
        vm.deal(client, 100 ether);
        deadline = uint64(block.timestamp + 7 days);
    }

    function _create(uint256 amount) internal returns (uint256 id) {
        vm.prank(client);
        id = pact.createDeal{value: amount}(freelancer, deadline, "Landing page redesign");
    }

    // ---------------------------------------------------------------- create

    function test_CreateDeal_StoresAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit DealCreated(1, client, freelancer, 1 ether, deadline, "Landing page redesign");
        uint256 id = _create(1 ether);

        Pact.Deal memory d = pact.getDeal(id);
        assertEq(id, 1);
        assertEq(d.client, client);
        assertEq(d.freelancer, freelancer);
        assertEq(d.amount, 1 ether);
        assertEq(d.deadline, deadline);
        assertEq(uint8(d.status), uint8(Pact.Status.Funded));
        assertEq(address(pact).balance, 1 ether);
        assertEq(pact.dealsOf(client)[0], 1);
        assertEq(pact.dealsOf(freelancer)[0], 1);
    }

    function test_CreateDeal_RevertsOnBadInput() public {
        vm.startPrank(client);
        vm.expectRevert(Pact.NoPayment.selector);
        pact.createDeal(freelancer, deadline, "x");

        vm.expectRevert(Pact.InvalidFreelancer.selector);
        pact.createDeal{value: 1}(address(0), deadline, "x");

        vm.expectRevert(Pact.InvalidFreelancer.selector);
        pact.createDeal{value: 1}(client, deadline, "x");

        vm.expectRevert(Pact.DeadlineInPast.selector);
        pact.createDeal{value: 1}(freelancer, uint64(block.timestamp), "x");

        vm.expectRevert(Pact.InvalidTitle.selector);
        pact.createDeal{value: 1}(freelancer, deadline, "");

        vm.expectRevert(Pact.InvalidTitle.selector);
        pact.createDeal{value: 1}(freelancer, deadline, string(new bytes(81)));
        vm.stopPrank();
    }

    function test_UnknownDeal_Reverts() public {
        vm.expectRevert(Pact.DealNotFound.selector);
        pact.getDeal(42);
    }

    // ---------------------------------------------------------------- happy path

    function test_DeliverThenRelease_PaysFreelancer() public {
        uint256 id = _create(2 ether);

        vm.expectEmit(true, false, false, true);
        emit Delivered(id, uint64(block.timestamp));
        vm.prank(freelancer);
        pact.markDelivered(id);

        vm.expectEmit(true, true, false, true);
        emit Released(id, freelancer, 2 ether, false);
        vm.prank(client);
        pact.release(id);

        assertEq(freelancer.balance, 2 ether);
        assertEq(address(pact).balance, 0);
        assertEq(uint8(pact.getDeal(id).status), uint8(Pact.Status.Released));
    }

    function test_ClientCanReleaseEarly() public {
        uint256 id = _create(1 ether);
        vm.prank(client);
        pact.release(id);
        assertEq(freelancer.balance, 1 ether);
    }

    // ---------------------------------------------------------------- access control

    function test_OnlyFreelancerCanDeliver() public {
        uint256 id = _create(1 ether);
        vm.prank(client);
        vm.expectRevert(Pact.NotFreelancer.selector);
        pact.markDelivered(id);
    }

    function test_OnlyClientCanRelease() public {
        uint256 id = _create(1 ether);
        vm.prank(freelancer);
        vm.expectRevert(Pact.NotClient.selector);
        pact.release(id);

        vm.prank(stranger);
        vm.expectRevert(Pact.NotClient.selector);
        pact.release(id);
    }

    function test_StrangerCannotRefund() public {
        uint256 id = _create(1 ether);
        vm.warp(deadline + 1);
        vm.prank(stranger);
        vm.expectRevert(Pact.NotClient.selector);
        pact.refund(id);
    }

    function test_CannotPayTwice() public {
        uint256 id = _create(1 ether);
        vm.startPrank(client);
        pact.release(id);
        vm.expectRevert(abi.encodeWithSelector(Pact.WrongStatus.selector, Pact.Status.Released));
        pact.release(id);
        vm.stopPrank();
    }

    function test_CannotDeliverTwice() public {
        uint256 id = _create(1 ether);
        vm.startPrank(freelancer);
        pact.markDelivered(id);
        vm.expectRevert(abi.encodeWithSelector(Pact.WrongStatus.selector, Pact.Status.Delivered));
        pact.markDelivered(id);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- freelancer protection

    function test_Claim_AfterReviewPeriod() public {
        uint256 id = _create(1 ether);
        vm.prank(freelancer);
        pact.markDelivered(id);

        uint64 claimableAt = uint64(block.timestamp) + pact.REVIEW_PERIOD();
        vm.warp(claimableAt - 1);
        vm.prank(freelancer);
        vm.expectRevert(abi.encodeWithSelector(Pact.ReviewPeriodActive.selector, claimableAt));
        pact.claim(id);

        vm.warp(claimableAt);
        vm.expectEmit(true, true, false, true);
        emit Released(id, freelancer, 1 ether, true);
        vm.prank(freelancer);
        pact.claim(id);
        assertEq(freelancer.balance, 1 ether);
    }

    function test_Claim_RequiresDelivery() public {
        uint256 id = _create(1 ether);
        vm.warp(block.timestamp + 30 days);
        vm.prank(freelancer);
        vm.expectRevert(abi.encodeWithSelector(Pact.WrongStatus.selector, Pact.Status.Funded));
        pact.claim(id);
    }

    function test_ClientCannotRefundAfterDelivery() public {
        uint256 id = _create(1 ether);
        vm.prank(freelancer);
        pact.markDelivered(id);
        vm.warp(deadline + 1);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(Pact.WrongStatus.selector, Pact.Status.Delivered));
        pact.refund(id);
    }

    // ---------------------------------------------------------------- client protection

    function test_ClientRefund_OnlyAfterDeadline() public {
        uint256 id = _create(3 ether);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(Pact.DeadlineNotReached.selector, deadline));
        pact.refund(id);

        vm.warp(deadline + 1);
        vm.expectEmit(true, true, false, true);
        emit Refunded(id, client, 3 ether);
        vm.prank(client);
        pact.refund(id);
        assertEq(client.balance, 100 ether);
        assertEq(uint8(pact.getDeal(id).status), uint8(Pact.Status.Refunded));
    }

    function test_FreelancerCanRefundAnytime() public {
        uint256 id = _create(1 ether);
        vm.prank(freelancer);
        pact.refund(id);
        assertEq(client.balance, 100 ether);
    }

    function test_FreelancerCannotRefundAfterPayout() public {
        uint256 id = _create(1 ether);
        vm.prank(client);
        pact.release(id);
        vm.prank(freelancer);
        vm.expectRevert(abi.encodeWithSelector(Pact.WrongStatus.selector, Pact.Status.Released));
        pact.refund(id);
    }

    function test_OnlyFreelancerCanClaim() public {
        uint256 id = _create(1 ether);
        vm.prank(freelancer);
        pact.markDelivered(id);
        vm.warp(block.timestamp + pact.REVIEW_PERIOD());
        vm.prank(client);
        vm.expectRevert(Pact.NotFreelancer.selector);
        pact.claim(id);
    }

    // ---------------------------------------------------------------- safety

    function test_Reentrancy_CannotDoubleClaim() public {
        GreedyFreelancer greedy = new GreedyFreelancer(pact);
        vm.prank(client);
        uint256 id = pact.createDeal{value: 5 ether}(address(greedy), deadline, "Audit");
        vm.prank(client);
        pact.createDeal{value: 5 ether}(freelancer, deadline, "Other job"); // funds that must stay put

        greedy.setDeal(id);
        greedy.deliver();
        vm.warp(block.timestamp + pact.REVIEW_PERIOD());
        greedy.claimIt();

        assertEq(address(greedy).balance, 5 ether);
        assertEq(address(pact).balance, 5 ether);
        assertEq(greedy.reentries(), 1);
    }

    function test_TransferFailure_RevertsAndKeepsFunds() public {
        Rejecter r = new Rejecter();
        vm.prank(client);
        uint256 id = pact.createDeal{value: 1 ether}(address(r), deadline, "Logo");
        vm.prank(client);
        vm.expectRevert(Pact.TransferFailed.selector);
        pact.release(id);
        assertEq(address(pact).balance, 1 ether);
        assertEq(uint8(pact.getDeal(id).status), uint8(Pact.Status.Funded));
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_ReleaseConservesFunds(uint96 amount, uint32 extraTime) public {
        amount = uint96(bound(amount, 1, 50 ether));
        uint64 dl = uint64(block.timestamp) + 1 + uint64(extraTime);
        vm.prank(client);
        uint256 id = pact.createDeal{value: amount}(freelancer, dl, "Fuzz job");
        uint256 before = client.balance + freelancer.balance + address(pact).balance;

        vm.prank(client);
        pact.release(id);

        assertEq(client.balance + freelancer.balance + address(pact).balance, before);
        assertEq(freelancer.balance, amount);
    }

    function testFuzz_RefundAfterDeadline(uint96 amount, uint32 wait) public {
        amount = uint96(bound(amount, 1, 50 ether));
        uint256 id = _create(amount);
        vm.warp(uint256(deadline) + 1 + wait);
        vm.prank(client);
        pact.refund(id);
        assertEq(client.balance, 100 ether);
        assertEq(address(pact).balance, 0);
    }
}
