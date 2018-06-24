import { describe, it, before } from 'mocha';

import creds from '../service-account-creds.json';
import sheet_ids from '../config';
import _ from 'lodash';
import path from 'path';

import { should, assert, expect } from 'chai';
import * as chai from 'chai';
import cap from 'chai-as-promised';
import { IndexSignature } from '../../src/types';
import { GoogleSpreadsheet } from '../../src/old/GoogleSpreadsheet';

chai.use(cap);

should();

const docs: IndexSignature<GoogleSpreadsheet> = {};
Object.keys(sheet_ids).forEach(key => {
	docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});

describe('Authentication', function() {
	this.timeout(5000);

	describe('without auth', () => {
		describe('reading + getInfo', () => {
			it('getInfo should fail on a private doc', async () => {
				return expect(docs['private'].getInfo()).to.be.rejectedWith(
					'Sheet is private. Use authentication or make public.',
				);
			});

			it('should fail on a private doc', async () => {
				return expect(docs['private'].getRows(1)).to.be.rejectedWith(
					'Sheet is private. Use authentication or make public.',
				);
			});

			_.each(['public', 'public-read-only'], key => {
				it('reading should succeed on a ' + key + ' doc', async () => {
					const rows = await docs[key].getRows(1);
					rows.should.be.an('array');
				});

				it('getInfo should succeed on a ' + key + ' doc', async () => {
					const info = await docs[key].getInfo();
					info.title.should.be.a('string');
				});
			});
		});

		describe('writing', () => {
			// it still fails on the public doc because you always need to auth
			_.each(['public', 'public-read-only', 'private'], key => {
				it('should fail on a ' + key + ' doc', async () => {
					try {
						await docs[key].addWorksheet();
						assert.isTrue(false, 'should throw');
					} catch (err) {
						err.should.be.an('Error');
						err.message.should.include('authenticate');
					}
				});
			});
		});
	});

	describe('authentication', () => {
		it('should fail if the token is empty', async () => {
			return expect(docs['private'].useServiceAccountAuth({})).to.be.rejected;
		});

		it('should fail if the key is no good', async () => {
			return expect(
				docs['private'].useServiceAccountAuth({
					client_email: 'test@example.com',
					private_key: 'not-a-real-key',
				}),
			).to.be.rejected;
		});

		it('should fail if the email and key do not match', async () => {
			const bad_creds = _.clone(creds);
			bad_creds.client_email = 'a' + bad_creds.client_email;
			return expect(docs['private'].useServiceAccountAuth(bad_creds)).to.be
				.rejected;
		});

		it('should succeed if the creds are valid', async () => {
			return docs['private'].useServiceAccountAuth(creds);
		});

		it('should accept a string which is a path to the file', async () => {
			const creds_file_path = path.resolve(
				__dirname + '/service-account-creds.json',
			);
			return docs['private'].useServiceAccountAuth(creds_file_path);
		});

		it('should fail if the path is invalid', async () => {
			const creds_file_path = path.resolve(__dirname + '/doesnt-exist.json');
			return expect(docs['private'].useServiceAccountAuth(creds_file_path)).to
				.be.rejected;
		});
	});
});

describe('with auth', function() {
	this.timeout(5000);

	before(async () => {
		for (const doc of Object.values(docs)) {
			await (doc as any).useServiceAccountAuth(creds);
		}
	});

	_.each(['public', 'public-read-only', 'private'], key => {
		it('getInfo should succeed on a ' + key + ' doc', async () => {
			await docs[key].getInfo();
		});

		it('reading data succeed on a ' + key + ' doc', async () => {
			const rows = await docs[key].getRows(1);
			rows.should.be.an('array');
		});
	});

	_.each(['public', 'private'], key => {
		it('writing should succeed on a ' + key + ' doc', async () => {
			const sheet = await docs[key].addWorksheet();
			return sheet.del();
		});
	});

	it('writing should fail if user does not have access', async () => {
		return expect(docs['public-read-only'].addWorksheet()).to.be.rejectedWith(
			'Request failed with status code 403',
		);
	});
});
