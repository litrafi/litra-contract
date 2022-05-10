import { isEqual } from "lodash";

export enum SychroniseResult {
    DEPLOY_NEW,
    CONFIG_CHANGE,
    CONFIG_UNCHANGED
}

export abstract class Synchroniser<SynchroniserConfig> {
    protected synchroniseFuncs: {
        [key in (keyof SynchroniserConfig)]: (fileConfig: SynchroniserConfig[key], onlineConfig: SynchroniserConfig[key]) => Promise<void>
    }

    protected fileConfig: SynchroniserConfig;
    protected onlineConfig: SynchroniserConfig | undefined;

    constructor() {
        this.synchroniseFuncs = this.getSynchroniseFuncs();
        this.fileConfig = this.getConfigFromFile();
    }

    protected abstract getConfigFromFile(): SynchroniserConfig;
    protected abstract getConfigOnline(): Promise<SynchroniserConfig>;
    protected abstract hasDeployed(): boolean;
    protected abstract deploy(fileConfig: SynchroniserConfig): Promise<void>;
    protected abstract getSynchroniseFuncs(): {
        [key in (keyof SynchroniserConfig)]: 
            ((fileConfig: SynchroniserConfig[key], onlineConfig: SynchroniserConfig[key]) => Promise<void>)
            |
            ((fileConfig: SynchroniserConfig[key]) => Promise<void>)
    };

    protected abstract get logTag(): string;

    public async sychornise(): Promise<SychroniseResult> {
        if(!this.hasDeployed()) {
            console.log(`${this.logTag}: 开始部署,配置如下`, this.fileConfig);
            await this.deploy(this.fileConfig);
            console.log(`${this.logTag} 同步完成`)
            return SychroniseResult.DEPLOY_NEW;
        }
        this.fileConfig = this.getConfigFromFile();
        this.onlineConfig = await this.getConfigOnline();
        console.log(`${this.logTag}: 开始同步,文件配置`, this.fileConfig, '线上配置', this.onlineConfig);
        let result = SychroniseResult.CONFIG_UNCHANGED;
        for (const key in this.fileConfig) {
            const fileConfigItem = this.fileConfig[key];
            const onlineConfigItem = this.onlineConfig[key];
            if(!isEqual(fileConfigItem, onlineConfigItem)) {
                if(!this.synchroniseFuncs[key]) {
                    console.warn(`${this.logTag}: ${key} 属性缺少同步函数 `)
                }
                console.log(`${this.logTag}: ${key} 属性开始同步`)
                await this.synchroniseFuncs[key](fileConfigItem, onlineConfigItem);
                result = SychroniseResult.CONFIG_CHANGE;
                console.log(`${this.logTag}: ${key} 属性同步成功`)
            }
        }
        console.log(`${this.logTag} 同步完成`)
        return result;
    }
}