import { IPlatFormConfig } from "../ts/interface/IPlatFormConfig";

class IhostConfig {
    at: string
    ip: string
    mac: string
    name: string
    enableDeviceLog: boolean
    constructor() {
        this.at = ''
        this.ip = ''
        this.mac = ''
        this.name = ''
        this.enableDeviceLog = true
    }

    handleConfig(config: IPlatFormConfig) {
        const { ihost = {} } = config
        this.ip = this.ip || ihost.ip || '';
        this.at = ihost.at ?? '';
        this.mac = ihost.mac ?? '';
        this.name = ihost.ihostName ?? '';
        this.enableDeviceLog = config.enableDeviceLog ?? true
    }
}

const ihostConfig = new IhostConfig()
export default ihostConfig