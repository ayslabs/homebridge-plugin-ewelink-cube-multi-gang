export interface IPlatFormConfig {
	name?: string,
	platform: string,
	ihosts?: IHostsConfig[]
}

export interface IHostsConfig {
	ip: string,
	mac: string,
	name: string,
	at: string,
	isValid: boolean,
	devices: IDeviceConfig[]
}

export interface IDeviceConfig {
	serial_number: string,
	name: string,
	display_category: string
}