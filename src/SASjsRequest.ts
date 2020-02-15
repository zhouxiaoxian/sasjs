import * as moment from "moment";

export interface SASjsRequest {
  serviceLink: string;
  timestamp: moment.Moment;
  pgmCode: string;
  logLink: string;
}
