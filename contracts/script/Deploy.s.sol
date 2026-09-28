// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Pact} from "../src/Pact.sol";

/// Deploy:  forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --account <keystore-name>
contract Deploy is Script {
    function run() external returns (Pact pact) {
        vm.startBroadcast();
        pact = new Pact();
        vm.stopBroadcast();
        console.log("Pact deployed at", address(pact));
    }
}
