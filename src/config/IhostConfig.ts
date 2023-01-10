import { IPlatFormConfig } from "../ts/interface/IPlatFormConfig";

class IhostConfig {
	at: string
	ip: string
	enableDeviceLog: boolean
	constructor() {
		this.at = ''
		this.ip = ''
		this.enableDeviceLog = true
	}

	handleConfig(config: IPlatFormConfig) {
		const { ihost = {} } = config
		this.ip = ihost.ip ?? '';
		this.at = ihost.at ?? '';
		this.enableDeviceLog = config.enableDeviceLog ?? true
	}
}

const ihostConfig = new IhostConfig()
export default ihostConfig