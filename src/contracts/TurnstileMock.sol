//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

contract TurnstileMock {
    function assign(uint256 _id) external returns (uint256) {
      return _id;
    }
    
    function register(address) external returns(uint256) {
      return 1;
    }
}