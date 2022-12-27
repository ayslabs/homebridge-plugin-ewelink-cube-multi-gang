import { ECapability } from "../ts/enum/ECapability";
import { IDevice } from "../ts/interface/IDevice";
import _ from 'lodash';

//	获取多通道设备的通道数据
function getMultiDeviceChannel(device: IDevice) {
	const { capabilities } = device;
	if (!capabilities.length) return []
	const channelInfo: {
		name: string,
		value: string
	}[] = [];
	capabilities.forEach(cap => {
		if (cap.capability === ECapability.TOGGLE) {
			const channelName = _.get(device.tags, ['toggle', cap.name!]);
			if (!channelName) {
				channelInfo.push({
					name: `channel_${cap.name!}`,
					value: cap.name!
				})
			} else {
				channelInfo.push({
					name: channelName,
					value: cap.name!
				})
			}
		}
	})
	return channelInfo
}

//	根据设备能力判断是否挂载相应服务
function renderServiceByCapability(device: IDevice, capability: ECapability) {
	const { capabilities = [] } = device;
	if (!capabilities.length) return false;
	return capabilities.some(item => item.capability === capability)
}
export default { getMultiDeviceChannel, renderServiceByCapability }