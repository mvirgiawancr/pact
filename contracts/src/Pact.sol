// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Pact — escrow for freelance work
/// @notice A client locks ETH for a job. The freelancer marks it delivered, and the client releases
///         the payment. Both sides are protected: if the client goes quiet after delivery, the
///         freelancer can claim after a review period; if nothing is delivered by the deadline,
///         the client can take the money back.
contract Pact {
    enum Status {
        None,
        Funded,
        Delivered,
        Released,
        Refunded
    }

    struct Deal {
        address client;
        address freelancer;
        uint256 amount;
        uint64 deadline;
        uint64 deliveredAt;
        Status status;
        string title;
    }

    /// @notice How long the client has to review a delivery before the freelancer can claim.
    uint64 public constant REVIEW_PERIOD = 3 days;
    uint256 public constant MAX_TITLE_LENGTH = 80;

    uint256 public dealCount;
    mapping(uint256 => Deal) private _deals;
    mapping(address => uint256[]) private _dealsOf;

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

    error NoPayment();
    error InvalidFreelancer();
    error DeadlineInPast();
    error InvalidTitle();
    error DealNotFound();
    error NotClient();
    error NotFreelancer();
    error WrongStatus(Status current);
    error ReviewPeriodActive(uint64 claimableAt);
    error DeadlineNotReached(uint64 deadline);
    error TransferFailed();

    // ------------------------------------------------------------------ writes

    /// @notice Lock `msg.value` for `freelancer`, to be delivered before `deadline`.
    function createDeal(address freelancer, uint64 deadline, string calldata title)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert NoPayment();
        if (freelancer == address(0) || freelancer == msg.sender) revert InvalidFreelancer();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        uint256 len = bytes(title).length;
        if (len == 0 || len > MAX_TITLE_LENGTH) revert InvalidTitle();

        id = ++dealCount;
        _deals[id] = Deal({
            client: msg.sender,
            freelancer: freelancer,
            amount: msg.value,
            deadline: deadline,
            deliveredAt: 0,
            status: Status.Funded,
            title: title
        });
        _dealsOf[msg.sender].push(id);
        _dealsOf[freelancer].push(id);

        emit DealCreated(id, msg.sender, freelancer, msg.value, deadline, title);
    }

    /// @notice Freelancer says the work is done. Starts the client's review period.
    function markDelivered(uint256 id) external {
        Deal storage d = _get(id);
        if (msg.sender != d.freelancer) revert NotFreelancer();
        if (d.status != Status.Funded) revert WrongStatus(d.status);

        d.status = Status.Delivered;
        d.deliveredAt = uint64(block.timestamp);
        emit Delivered(id, d.deliveredAt);
    }

    /// @notice Client approves the work and pays the freelancer. Allowed before or after delivery.
    function release(uint256 id) external {
        Deal storage d = _get(id);
        if (msg.sender != d.client) revert NotClient();
        if (d.status != Status.Funded && d.status != Status.Delivered) revert WrongStatus(d.status);

        _settle(id, d, Status.Released, d.freelancer, false);
    }

    /// @notice Freelancer collects payment when the client hasn't responded within the review period.
    function claim(uint256 id) external {
        Deal storage d = _get(id);
        if (msg.sender != d.freelancer) revert NotFreelancer();
        if (d.status != Status.Delivered) revert WrongStatus(d.status);
        uint64 claimableAt = d.deliveredAt + REVIEW_PERIOD;
        if (block.timestamp < claimableAt) revert ReviewPeriodActive(claimableAt);

        _settle(id, d, Status.Released, d.freelancer, true);
    }

    /// @notice Return the money to the client.
    ///         The freelancer can do this at any time before payout (e.g. they can't take the job);
    ///         the client can only do it once the deadline passed without a delivery.
    function refund(uint256 id) external {
        Deal storage d = _get(id);
        if (msg.sender == d.freelancer) {
            if (d.status != Status.Funded && d.status != Status.Delivered) revert WrongStatus(d.status);
        } else if (msg.sender == d.client) {
            if (d.status != Status.Funded) revert WrongStatus(d.status);
            if (block.timestamp <= d.deadline) revert DeadlineNotReached(d.deadline);
        } else {
            revert NotClient();
        }

        _settle(id, d, Status.Refunded, d.client, false);
    }

    // ------------------------------------------------------------------ reads

    function getDeal(uint256 id) external view returns (Deal memory) {
        return _get(id);
    }

    /// @notice Every deal an address is part of, as client or freelancer.
    function dealsOf(address account) external view returns (uint256[] memory) {
        return _dealsOf[account];
    }

    // ------------------------------------------------------------------ internal

    function _get(uint256 id) private view returns (Deal storage d) {
        d = _deals[id];
        if (d.status == Status.None) revert DealNotFound();
    }

    /// @dev Checks-effects-interactions: the status is final before any ETH moves, so a re-entrant
    ///      call sees a settled deal and reverts. `amount` is kept for the deal's history.
    function _settle(uint256 id, Deal storage d, Status next, address to, bool claimed) private {
        uint256 amount = d.amount;
        d.status = next;

        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();

        if (next == Status.Released) emit Released(id, to, amount, claimed);
        else emit Refunded(id, to, amount);
    }
}
