import { HomebridgePluginUiServer } from '@homebridge/plugin-ui-utils';
import makeMdns from 'multicast-dns';
import httpRequest from '../service/httpRequest';
import { IMdnsResp } from '../ts/interface/IMdns';
import { EMethod } from '../ts/enum/EMethod';
import { IHttpConfig } from '../ts/interface/IHttpConfig';
import { EHttpPath } from '../ts/enum/EHttpPath';

const mdns = makeMdns()

class PluginUiServer extends HomebridgePluginUiServer {

	public mdnsDevices: Map<string, { ip: string, name: string }> = new Map()

	constructor() {
		super();
		//	开启mdns查询
		this.onRequest('/queryMdns', async () => {
			mdns.query({
				questions: [
					{
						name: 'ihost.local',
						type: 'A',
					},
				],
			})
			this.pushMdnsDevices();
		})
		//	根据ip查询
		this.onRequest('/getDeviceByIp', async () => {

		})
		//	获取 access_token
		this.onRequest('/getAccessToken', async (ip) => {
			// const res = await axios.get('http://localhost:1880/open-api/v1/rest/bridge/access_token')
			// const res = await axios.get(`http://${ip}/open-api/v1/rest/bridge/access_token`)
			if (!ip) {
				return {
					msg: 'invalid params'
				}
			}
			const httpConfig: IHttpConfig = {
				path: EHttpPath.ACCESS_TOKEN,
				ip,
				method: EMethod.GET
			}
			try {
				const resp = await httpRequest(httpConfig);
				return resp
			} catch (error) {
				return {
					error: 1000
				}
			}
		})
		//	获取 openapi 的设备
		this.onRequest('/getDevices', async (config) => {
			const { ip = '', at = '' } = config;
			if (!ip || !at) {
				return {
					msg: 'invalid params'
				}
			}
			const httpConfig: IHttpConfig = {
				path: EHttpPath.DEVICES,
				ip,
				method: EMethod.GET,
				at
			}
			try {
				const resp = await httpRequest(httpConfig);
				return resp
			} catch (error) {
				return {
					error: 1000,
					data: []
				}
			}
		})
		this.ready();
	}
	//	主动推送mdns查询到的设备给到前端
	pushMdnsDevices() {
		mdns.on('response', (response) => {
			const { answers } = response as { answers: IMdnsResp[] };
			if (!JSON.stringify(answers).includes('ihost')) return;
			for (let answer of answers) {
				if (answer.name.includes('ihost')) {
					const mac = ''
					!this.mdnsDevices.get(answer.name) && this.mdnsDevices.set(answer.name, { ip: answer.data, name: answer.name })
				}
			}
			if (this.mdnsDevices.size > 0) {
				this.pushEvent('getMdnsDevices', [...this.mdnsDevices.values()])
			}
		})
	}
}

(() => new PluginUiServer())();
