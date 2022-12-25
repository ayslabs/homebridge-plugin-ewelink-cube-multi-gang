import { IPlatFormConfig } from "../ts/interface/IPlatFormConfig";

class IhostConfig {
	at: string
	ip: string
	constructor() {
		this.at = ''
		this.ip = ''
	}

	handleConfig(config: IPlatFormConfig) {
		this.ip = config.ip ?? '';
		this.at = config.at ?? ''
	}
}

const ihostConfig = new IhostConfig()
export default ihostConfig