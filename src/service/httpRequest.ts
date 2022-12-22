import axios from "axios";
import { IHttpConfig } from "../ts/interface/IHttpConfig";
import { EHttpPath } from "../ts/enum/EHttpPath";

export default async function httpRequest(httpConfig: IHttpConfig): Promise<{ error: number, msg: string, data: any }> {
	const { ip, path, method, at = '', params } = httpConfig
	const url = `http://${ip}${EHttpPath.ROOT}${path}`
	const headers = {
		'Content-Type': 'application/json'
	}
	if (at) {
		Object.assign(headers, {
			'Authorization': `Bearer ${at}`
		})
	}
	const resp = await axios({
		url,
		method,
		headers,
		timeout: 5000
	})
	return resp.data
}

