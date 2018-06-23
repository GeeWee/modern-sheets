import { describe, it, before } from 'mocha';

import creds from './service-account-creds.json';
import sheet_ids from './config';
import { GoogleSpreadsheet } from '../index';
import _ from 'lodash';
import async from 'async';
import path from 'path';

import { should } from 'chai';
should();

const docs = {};
Object.keys(sheet_ids).forEach(key => {
	docs[key] = new GoogleSpreadsheet(sheet_ids[key]);
});

function getSheetName() {
	return 'test sheet' + (+new Date());
}

describe('Authentication', function () {
	this.timeout(5000);
	
	describe('without auth', () => {
		describe('reading + getInfo', () => {
			it('getInfo should fail on a private doc', done => {
				docs['private'].getInfo((err, info) => {
					err.should.be.an('Error');
					err.message.should.include('Sheet is private.');
					err.message.should.include('Use authentication or make public.');
					done();
				});
			});
			
			it('should fail on a private doc', done => {
				docs['private'].getRows(1, (err, rows) => {
					err.should.be.an('Error');
					err.message.should.include('Sheet is private.');
					err.message.should.include('Use authentication or make public.');
					done();
				});
			});
			
			_.each(['public', 'public-read-only'], key => {
				it('reading should succeed on a ' + key + ' doc', done => {
					docs[key].getRows(1, (err, rows) => {
						rows.should.be.an('array');
						done(err);
					});
				});
				
				it('getInfo should succeed on a ' + key + ' doc', done => {
					docs[key].getInfo((err, info) => {
						info.title.should.be.a.string;
						done(err);
					});
				});
			});
		});
		
		
		describe('writing', () => {
			// it still fails on the public doc because you always need to auth
			_.each(['public', 'public-read-only', 'private'], key => {
				it('should fail on a ' + key + ' doc', done => {
					docs[key].addWorksheet((err, sheet) => {
						err.should.be.an('Error');
						err.message.should.include('authenticate');
						done();
					});
				});
			});
		});
		
	});
	
	
	describe('authentication', () => {
		it('should fail if the token is empty', done => {
			docs['private'].useServiceAccountAuth({}, err => {
				err.should.be.an('Error');
				done();
			});
		});
		
		it('should fail if the key is no good', done => {
			docs['private'].useServiceAccountAuth({
				client_email: 'test@example.com',
				private_key: 'not-a-real-key'
			}, err => {
				err.should.be.an('Error');
				done();
			});
		});
		
		it('should fail if the email and key do not match', done => {
			const bad_creds = _.clone(creds);
			bad_creds.client_email = 'a' + bad_creds.client_email;
			docs['private'].useServiceAccountAuth(bad_creds, err => {
				err.should.be.an('Error');
				done();
			});
		});
		
		it('should succeed if the creds are valid', done => {
			docs['private'].useServiceAccountAuth(creds, err => {
				(err == null).should.be.true;
				done();
			});
		});
		
		it('should accept a string which is a path to the file', done => {
			const creds_file_path = path.resolve(__dirname + '/service-account-creds.json');
			docs['private'].useServiceAccountAuth(creds_file_path, err => {
				(err == null).should.be.true;
				done();
			});
		});
		
		it('should fail if the path is invalid', done => {
			const creds_file_path = path.resolve(__dirname + '/doesnt-exist.json');
			docs['private'].useServiceAccountAuth(creds_file_path, err => {
				err.should.be.an('Error');
				done();
			});
		});
	});
	
	
	describe('with auth', () => {
		before(done => {
			async.each(docs, (doc: any, nextDoc) => {
				doc.useServiceAccountAuth(creds, nextDoc);
			}, done);
		});
		
		_.each(['public', 'public-read-only', 'private'], key => {
			it('getInfo should succeed on a ' + key + ' doc', done => {
				docs[key].getInfo((err, info) => {
					(err == null).should.be.true;
					done();
				});
			});
			
			it('reading data succeed on a ' + key + ' doc', done => {
				docs[key].getRows(1, (err, rows) => {
					(err == null).should.be.true;
					rows.should.be.an('array');
					done();
				});
			});
		});
		
		_.each(['public', 'private'], key => {
			it('writing should succeed on a ' + key + ' doc', done => {
				docs[key].addWorksheet((err, sheet) => {
					(err == null).should.be.true;
					sheet.del(done);
				});
			});
		});
		
		it('writing should fail if user does not have access', done => {
			docs['public-read-only'].addWorksheet((err, sheet) => {
				console.log(typeof err);
				err.should.be.an('Error');
				err.message.should.include('Request failed with status code 403');
				done();
			});
		});
	});
	
});
