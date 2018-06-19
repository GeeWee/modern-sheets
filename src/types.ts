/**
 * TODO: Describe file contents
 */
export type SpreadsheetCellData = any;
export type Links = any;

export type Callback<T = any> = (err? : any, res? : T) => void


export interface Foo {
	
	'$': { 'gd:etag': string },
	'app:edited': {
		'$': {
			'xmlns:app': string
		},
		_: string
	},
	category: {
		'$': {
			scheme: string,
			term: string
		}
	},
	content: string,
	'gs:cell': {
		'$':
			{
				col: string,
				inputValue: string, numericValue: string,
				row: string
			},
		_: string
	},
	id: string,
	link: {
		'$': {
			href: string,
			rel: string,
			type: string
		}
	}[],
	title: string,
	updated: string
}
