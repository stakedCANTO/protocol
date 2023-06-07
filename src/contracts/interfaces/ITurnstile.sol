//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

interface ITurnstile {
    function assign(uint256) external returns (uint256);

    function register(address) external returns (uint256);
}
