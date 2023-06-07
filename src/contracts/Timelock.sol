//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ITurnstile} from "./interfaces/ITurnstile.sol";

contract Timelock is TimelockController {
  constructor(address[] memory _multisigs, address admin)
    TimelockController(10 minutes, _multisigs, _multisigs, admin) {}
}