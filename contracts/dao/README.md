# litra-contract/contracts/dao
关于DAO功能的合约

- admin: 基类合约，用于被继承。继承者具备通用的调用权限限制功能，即管理者限制。
- FeeManager: 用于在用户Wrap与Unwrap时收取WNFT手续费。
- Burner: 在FeeManager中将对于不同的WNFT种类设置不同的Burner，Burner用于将WNFT转换为ETH，并发送到FeeDistributor合约中。
- AragonImport: 引用来自[AragonOS](https://github.com/aragon/aragonOS)的合约。
- Fork自[curve-dao](https://github.com/curvefi/curve-dao-contracts)的合约: 所有以vy为后缀的vyper代码文件。源代码中关于固定合约地址部分在此改为在构造函数处传入，其他部分不变。
- Voting: Fork自[curve-aragon-voting](https://github.com/curvefi/curve-aragon-voting)