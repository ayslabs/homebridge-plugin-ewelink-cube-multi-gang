export interface IPlatFormConfig {
	name?: string,
	platform: string,
	ip?: string,
	mac?: string,
	ihostName?: string,
	at?: string,
	isValid?: boolean,
	devices?: IDeviceConfig[],
	enableDeviceLog?: boolean
}

export interface IDeviceConfig {
	serial_number: string,
	name: string,
	display_category: string,
	checked: boolean
}