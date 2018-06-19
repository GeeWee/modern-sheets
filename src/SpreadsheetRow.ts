import { forceArray, xmlSafeColumnName, xmlSafeValue } from './utils';
import * as _ from 'lodash';
import { GoogleSpreadsheet } from './GoogleSpreadsheet';
import { Callback, Links, SpreadsheetRowData } from './types';

/**
 * TODO: Describe file contents
 */

export class SpreadsheetRow {
	private spreadsheet: GoogleSpreadsheet;
	private _xml: string;
	private _links: Links;
	private id: string;
	private gsx: any;
	
	constructor(spreadsheet : GoogleSpreadsheet, data: SpreadsheetRowData, xml: string){
		this.spreadsheet = spreadsheet;
		this._xml = xml;
		
		
		//This is fucked up yo. Rewrite this to reach into the data object directly
		_.forEach(data, (val, key) => {
			if(key.substring(0, 4) === "gsx:") {
				if(typeof val === 'object' && Object.keys(val).length === 0) {
					val = null;
				}
				if (key == "gsx:") {
					//wtf
					this.gsx = val;
				} else {
					//@ts-ignore
					this[key.substring(4)] = val;
				}
			} else {
				if (key == "id") {
					this.id  = val;
				} else if (val['_']) {
					//@ts-ignore
					this[key] = val['_'];
				} else if ( key == 'link' ){
					this._links = [];
					val = forceArray( val );
					val.forEach( ( link: any ) => {
						this['_links'][ link['$']['rel'] ] = link['$']['href'];
					});
				}
			}
		});
	}
	
	save = ( cb : Callback ) => {
		/*
		API for edits is very strict with the XML it accepts
		So we just do a find replace on the original XML.
		It's dumb, but I couldnt get any JSON->XML conversion to work reliably
		*/
		
		let data_xml = this['_xml'];
		// probably should make this part more robust?
		data_xml = data_xml.replace('<entry>', "<entry xmlns='http://www.w3.org/2005/Atom' xmlns:gsx='http://schemas.google.com/spreadsheets/2006/extended'>");
		
		Object.keys( this ).forEach( (key) => {
			//@ts-ignore
			if (key.substr(0,1) != '_' && typeof( this[key] == 'string') ){
				//@ts-ignore
				data_xml = data_xml.replace( new RegExp('<gsx:'+xmlSafeColumnName(key)+">([\\s\\S]*?)</gsx:"+xmlSafeColumnName(key)+'>'), '1<gsx:'+xmlSafeColumnName(key)+'>'+ xmlSafeValue(this[key]) +'</gsx:'+xmlSafeColumnName(key)+'>');
			}
		});
		this.spreadsheet.makeFeedRequest( this['_links']['edit'], 'PUT', data_xml, cb );
	};
	
	del = ( cb : Callback ) => {
		this.spreadsheet.makeFeedRequest( this['_links']['edit'], 'DELETE', null, cb );
	}
}
