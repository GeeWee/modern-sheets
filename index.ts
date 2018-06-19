import async from 'async';
import request from 'request';
import xml2js from 'xml2js';
import http from 'http';
import querystring from 'querystring';
import _ from 'lodash';
import * as gal from 'google-auth-library';
import { forceArray, xmlSafeColumnName, xmlSafeValue } from './src/utils';
import { SpreadsheetCell } from './src/SpreadsheetCell';
import { SpreadsheetRow } from './src/SpreadsheetRow';
import { SpreadsheetWorksheet } from './src/SpreadsheetWorksheet';

const GOOGLE_FEED_URL = 'https://spreadsheets.google.com/feeds/';
const GOOGLE_AUTH_SCOPE = ['https://spreadsheets.google.com/feeds'];

const REQUIRE_AUTH_MESSAGE = 'You must authenticate to modify sheet data';

// The main class that represents a single sheet
// this is the main module.exports

import {GoogleSpreadsheet as gs} from './src/GoogleSpreadsheet';

export const GoogleSpreadsheet = gs;
