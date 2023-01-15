import { IDevice } from "./IDevice";

/**
 * add device
 */
export interface IResponseDeviceObject {
	payload: IDevice
}

/**
 * update device state
 */
export interface IUpdateDeviceState {
	endpoint: IEndpointObject,
	payload: any
}

/**
 * update device info
 */
export interface IUpdateDeviceInfo {
	endpoint: IEndpointObject,
	payload: {
		name: string
	}
}

/**
 * delete device
 */
export interface IDeleteDevice {
	endpoint: IEndpointObject
}

/**
 * device offline
 */

export interface IUpdateDeviceOnline {
	endpoint: IEndpointObject,
	payload: {
		online: boolean
	}

}
interface IEndpointObject {
	serial_number: string,
	third_serial_number: string
}