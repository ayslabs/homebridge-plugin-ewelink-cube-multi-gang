import { HomebridgePluginUiServer } from '@homebridge/plugin-ui-utils';
import makeMdns, { MulticastDNS } from 'multicast-dns';
import httpRequest from '../service/httpRequest';
import { IMdnsResp } from '../ts/interface/IMdns';
import { EMethod } from '../ts/enum/EMethod';
import { IHttpConfig } from '../ts/interface/IHttpConfig';
import { EHttpPath } from '../ts/enum/EHttpPath';

class PluginUiServer extends HomebridgePluginUiServer {

    public mdnsDevices: Map<string, { ip: string, name: string, mac: string }> = new Map()
    public mdns: MulticastDNS | undefined = undefined
    constructor() {
        super();
        this.mdns = makeMdns()
        //	start mdns query
        this.onRequest('/queryMdns', async () => {
            this.queryDevices();
            this.pushMdnsDevices();
        })
        //	according to the ip
        this.onRequest('/getDeviceByIp', async (ip: string) => {
            return await this.getDeviceByIp(ip)
        })
        //	get access_token
        this.onRequest('/getAccessToken', async (ip) => {
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
        //	get open api devices
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
        //	Destroy the mdns instance. Closes the udp socket.
        this.onRequest('/closeQuery', async () => {
            this.mdns?.destroy()
        })
        this.ready();
    }
    //	push the mdns devices to the front
    pushMdnsDevices() {
        this.mdns?.on('response', async (response) => {
            const { answers } = response as { answers: IMdnsResp[] };
            if (!JSON.stringify(answers).includes('ihost') && !JSON.stringify(answers).includes('NSPanelPro')) return;
            for (let answer of answers) {
                const isHost = answer.name.includes('ihost');
                const isNsPanelPro = answer.name.includes('NSPanelPro');
                if (isHost || isNsPanelPro) {
                    const ip = isNsPanelPro ? `${answer.data}:8081` : answer.data;
                    const response = await this.getDeviceByIp(ip);
                    if (response.error === 0 && response.data) {
                        const { mac } = response.data as { mac: string, ip: string }
                        !this.mdnsDevices.get(mac) && this.mdnsDevices.set(mac, { ip, mac, name: answer.name })
                    }
                }
            }
            if (this.mdnsDevices.size > 0) {
                this.pushEvent('getMdnsDevices', [...this.mdnsDevices.values()])
            }
        })
    }
    queryDevices() {
        this.mdns?.query({
            questions: [
                {
                    name: 'ihost.local',
                    type: 'A',
                },
                {
                    name: 'nspanelpro.local',
                    type: 'A',
                },
                {
                    name: 'ihost-2.local',
                    type: 'A',
                },
                {
                    name: 'ihost-3.local',
                    type: 'A',
                },
            ],
        })
    }
    async getDeviceByIp(ip: string) {
        if (!ip) {
            return {
                msg: 'invalid params'
            }
        }
        const httpConfig: IHttpConfig = {
            path: EHttpPath.IHOST_INFO,
            ip,
            method: EMethod.GET,
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
    }
}

(() => new PluginUiServer())();
