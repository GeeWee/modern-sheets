export function forceArray<T>(val: T | T[]) : T[] {
	if ( Array.isArray( val ) ) return val;
	if ( !val ) return [];
	return [ val ];
}

export function xmlSafeValue(val: (cb: any) => |number|string) : string{
	if ( val == null ) return '';
	return String(val).replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/\n/g,'&#10;')
		.replace(/\r/g,'&#13;');
}

export function xmlSafeColumnName(val: string) : string{
	if (!val) return '';
	return String(val).replace(/[\s_]+/g, '')
		.toLowerCase();
}
