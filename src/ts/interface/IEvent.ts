import { IDevice } from "./IDevice";

/**
 * 新增设备事件
 */
export interface IResponseDeviceObject {
	payload: IDevice
}

/**
 * 设备状态更新事件
 */
export interface IUpdateDeviceState {
	endpoint: IEndpointObject,
	payload: any
}

/**
 * 设备信息更新事件
 */
export interface IUpdateDeviceInfo {
	endpoint: IEndpointObject,
	payload: {
		name: string
	}
}

/**
 * 设备删除事件
 */
export interface IDeleteDevice {
	endpoint: IEndpointObject,
}

interface IEndpointObject {
	serial_number: string,
	third_serial_number: string
}