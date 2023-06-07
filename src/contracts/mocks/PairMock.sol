//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

contract PairMock {
    function prices(
        address _tokenIn,
        uint256 _amountIn,
        uint256 _points
    ) external pure returns (uint256[] memory) {
        uint256[] memory pricesToReturn = new uint256[](_points);
        uint256 percentPrem = 10;
        uint256 currentPrice = _amountIn / 6; // currently about 6 blotr per sCANTO
        for (uint i = 0; i < _points; i++) {
            pricesToReturn[i] =
                currentPrice +
                ((i + 1) * percentPrem * currentPrice) /
                100;
        }
        _tokenIn; // so linter doesn't complain.
        return pricesToReturn;
    }
}
