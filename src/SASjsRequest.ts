import * as moment from "moment";

export interface SASjsRequest {
  serviceLink: string;
  timestamp: moment.Moment;
  sourceCode: string;
  generatedCode: string;
  logLink: string;
}
