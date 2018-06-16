import { forceArray, xmlSafeColumnName, xmlSafeValue } from './utils';
import * as _ from 'lodash';

/**
 * TODO: Describe file contents
 */

export class SpreadsheetRow {
	private spreadsheet: any;
	private _xml: any;
	
	constructor(spreadsheet,data,xml){
		this.spreadsheet = spreadsheet;
		this._xml = xml;
		
		_.forEach(data, (val, key) => {
			if(key.substring(0, 4) === "gsx:") {
				if(typeof val === 'object' && Object.keys(val).length === 0) {
					val = null;
				}
				if (key == "gsx:") {
					this[key.substring(0, 3)] = val;
				} else {
					this[key.substring(4)] = val;
				}
			} else {
				if (key == "id") {
					this[key] = val;
				} else if (val['_']) {
					this[key] = val['_'];
				} else if ( key == 'link' ){
					this['_links'] = [];
					val = forceArray( val );
					val.forEach( ( link ) => {
						this['_links'][ link['$']['rel'] ] = link['$']['href'];
					});
				}
			}
		});
	}
	
	save = ( cb ) => {
		/*
		API for edits is very strict with the XML it accepts
		So we just do a find replace on the original XML.
		It's dumb, but I couldnt get any JSON->XML conversion to work reliably
		*/
		
		let data_xml = this['_xml'];
		// probably should make this part more robust?
		data_xml = data_xml.replace('<entry>', "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gsx='http://schemas.google.com/spreadsheets/2006/extended'>");
		
		Object.keys( this ).forEach( (key) => {
			if (key.substr(0,1) != '_' && typeof( this[key] == 'string') ){
				data_xml = data_xml.replace( new RegExp('<gsx:'+xmlSafeColumnName(key)+">([\\s\\S]*?)</gsx:"+xmlSafeColumnName(key)+'>'), '<gsx:'+xmlSafeColumnName(key)+'>'+ xmlSafeValue(this[key]) +'</gsx:'+xmlSafeColumnName(key)+'>');
			}
		});
		this.spreadsheet.makeFeedRequest( this['_links']['edit'], 'PUT', data_xml, cb );
	};
	del = ( cb ) => {
		this.spreadsheet.makeFeedRequest( this['_links']['edit'], 'DELETE', null, cb );
	}
}
