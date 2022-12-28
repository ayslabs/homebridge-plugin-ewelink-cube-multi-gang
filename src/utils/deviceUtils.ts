import { ECapability } from '../ts/enum/ECapability';
import { IDevice, IDeviceState } from '../ts/interface/IDevice';
import _ from 'lodash';

//	获取多通道设备的通道数据
function getMultiDeviceChannel(device: IDevice) {
    const { capabilities } = device;
    if (!capabilities.length) return [];
    const channelInfo: {
        name: string;
        value: string;
    }[] = [];
    capabilities.forEach((cap) => {
        if (cap.capability === ECapability.TOGGLE) {
            const channelName = _.get(device.tags, ['toggle', cap.name!]);
            if (!channelName) {
                channelInfo.push({
                    name: `channel_${cap.name!}`,
                    value: cap.name!
                });
            } else {
                channelInfo.push({
                    name: channelName,
                    value: cap.name!
                });
            }
        }
    });
    return channelInfo;
}

//	根据设备能力判断是否挂载相应服务
function renderServiceByCapability(device: IDevice, capability: ECapability) {
    const { capabilities = [] } = device;
    if (!capabilities.length) return false;
    return capabilities.some((item) => item.capability === capability);
}

const DeviceStateMap = new Map<keyof IDeviceState, (device: IDevice) => any>([
    [
        'online',
        (device: IDevice) => _.get(device, 'online', false)
    ],
    [
        'switch',
        (device: IDevice) => _.get(device, ['state', 'powerState'], 'off') === 'on'
    ],
    [
        'switch_0',
        (device: IDevice) => _.get(device, ['state', 'toggle', '1', 'toggleState'], 'off') === 'on'
    ],
    [
        'switch_1',
        (device: IDevice) => _.get(device, ['state', 'toggle', '2', 'toggleState'], 'off') === 'on'
    ],
    [
        'switch_2',
        (device: IDevice) => _.get(device, ['state', 'toggle', '3', 'toggleState'], 'off') === 'on'
    ],
    [
        'switch_3',
        (device: IDevice) => _.get(device, ['state', 'toggle', '4', 'toggleState'], 'off') === 'on'
    ],
    [
        'battery',
        (device: IDevice) => _.get(device, ['state', 'battery', 'battery'], 0)
    ],
    [
        'percent',
        (device: IDevice) => _.get(device, ['state', 'percentage', 'percentage'], 100)
    ],
    [
        'detected',
        (device: IDevice) => _.get(device, ['state', 'detect', 'detected'], true)
    ],
    [
        'brightness',
        (device: IDevice) => _.get(device, ['state', 'brightness', 'brightness'], 100)
    ],
    [
        'colorTemperature',
        (device: IDevice) => _.get(device, ['state', 'color-temperature', 'colorTemperature'], 50)
    ],
    [
        'temperature',
        (device: IDevice) => _.get(device, ['state', 'temperature', 'temperature'], 26.5)
    ],
    [
        'humidity',
        (device: IDevice) => _.get(device, ['state', 'humidity', 'humidity'], 50)
    ]
]);
// 初始化设备状态
function getDeviceState(state: IDeviceState, device: IDevice) {
    const res: IDeviceState = {};
    const props = Object.keys(state) as (keyof IDeviceState)[];
    props.forEach((prop) => {
        res[prop] = DeviceStateMap.get(prop)!(device);
    });
    return res;
}
export default { getMultiDeviceChannel, renderServiceByCapability, getDeviceState };
