# @version 0.3.1
"""
@title Curve Factory
@license MIT
@author Curve.Fi
@notice Permissionless pool deployer and registry
"""
interface LiquidityGauge:
    def initialize(
        _lp_token: address,
        _LA: address,
        _gauge_controller: address,
        _minter: address,
        _veboost_proxy: address,
        _voting_escrow: address
    ): nonpayable

event LiquidityGaugeDeployed:
    token: address
    gauge: address

event UpdateGaugeImplementation:
    _old_gauge_implementation: address
    _new_gauge_implementation: address

event TransferOwnership:
    _old_owner: address
    _new_owner: address


admin: public(address)
future_admin: public(address)

gauge_implementation: public(address)
token_gauges: public(HashMap[address, address])

LA: public(address)
gauge_controller: public(address)
minter: public(address)
veboost_proxy: public(address)
voting_escrow: public(address)

@external
def __init__(
    _gauge_implementation: address,
    _LA: address,
    _gauge_controller: address,
    _minter: address,
    _veboost_proxy: address,
    _voting_escrow: address,
):
    self.gauge_implementation = _gauge_implementation
    self.LA = _LA
    self.gauge_controller = _gauge_controller
    self.minter = _minter
    self.veboost_proxy = _veboost_proxy
    self.voting_escrow = _voting_escrow

    self.admin = msg.sender

    log UpdateGaugeImplementation(ZERO_ADDRESS, _gauge_implementation)
    log TransferOwnership(ZERO_ADDRESS, msg.sender)


@external
def deploy_gauge(_token: address) -> address:
    """
    @notice Deploy a liquidity gauge for a factory pool
    @param _token Factory pool address to deploy a gauge for
    @return Address of the deployed gauge
    """
    assert self.token_gauges[_token] == ZERO_ADDRESS, "Gauge already deployed"

    gauge: address = create_forwarder_to(self.gauge_implementation)
    LiquidityGauge(gauge).initialize(_token, self.LA, self.gauge_controller, self.minter, self.veboost_proxy, self.voting_escrow)
    self.token_gauges[_token] = gauge

    log LiquidityGaugeDeployed(_token, gauge)
    return gauge

# <--- Admin / Guarded Functionality --->

@external
def set_gauge_implementation(_gauge_implementation: address):
    """
    @notice Set gauge implementation
    @dev Set to ZERO_ADDRESS to prevent deployment of new gauges
    @param _gauge_implementation Address of the new token implementation
    """
    assert msg.sender == self.admin  # dev: admin-only function

    log UpdateGaugeImplementation(self.gauge_implementation, _gauge_implementation)
    self.gauge_implementation = _gauge_implementation


@external
def commit_transfer_ownership(_addr: address):
    """
    @notice Transfer ownership of this contract to `addr`
    @param _addr Address of the new owner
    """
    assert msg.sender == self.admin  # dev: admin only

    self.future_admin = _addr


@external
def accept_transfer_ownership():
    """
    @notice Accept a pending ownership transfer
    @dev Only callable by the new owner
    """
    assert msg.sender == self.future_admin  # dev: future admin only

    log TransferOwnership(self.admin, msg.sender)
    self.admin = msg.sender