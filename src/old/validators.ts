import * as t from 'io-ts';
const ColumnString = t.refinement(t.string, s => {
	const startsWithC = s.startsWith('c');
	const endsWithNumber = s.match(/\d+$/);
	if (!endsWithNumber || !startsWithC) {
		return false;
	}
	return true;
});
