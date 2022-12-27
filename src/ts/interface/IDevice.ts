import { ECategory } from '../enum/ECategory'
import { ECapability } from '../enum/ECapability'
interface IDevice {
	serial_number: string,
	name: string,
	manufacturer: string,
	model: string,
	firmware_version: string,
	display_category: ECategory,
	link_layer_type?: string,
	capabilities: ICapability[],
	state: any,
	online: boolean,
	tags: any
}

interface ICapability {
	capability: ECapability
	permission: string
	name?: string
}


export { IDevice }