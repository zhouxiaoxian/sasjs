/// <reference types="cypress" />
import SASjs from "../../../src/index";
import { any } from "cypress/types/bluebird";

const adapter = new SASjs({
  serverUrl: Cypress.env("serverUrl"),
  port: Cypress.env("port"),
  pathSAS9: "/SASStoredProcess/do",
  pathSASViya: "/SASJobExecution",
  appLoc: Cypress.env("appLoc"),
  serverType: Cypress.env("serverType"),
  debug: Cypress.env("debug")
});

context("Testing SAS", () => {
  it("User login", done => {
    adapter.logIn(Cypress.env("username"), Cypress.env("password")).then(
      (res: any) => {
        expect(res.isLoggedIn).to.equal(true);
        done();
      },
      err => {
        console.log(err);
        done("User not logged");
      }
    );
  });

  it("ARR, single string value", done => {
    const data: any = { table1: [{ col1: "first col value" }] };
    adapter.request("common/sendArr", data).then((res: any) => {
      expect(res.table1[0][0]).to.not.be.undefined;
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      done();
    });
  });
  it("OBJ, single string value", done => {
    const data: any = { table1: [{ col1: "first col value" }] };
    adapter.request("common/sendObj", data).then((res: any) => {
      expect(res.table1[0].COL1).to.not.be.undefined;
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      done();
    });
  });
  it("ARR, long string (32765)", done => {
    /* cannot use repeat() function due to strange typings */
    let x = "X";
    for (var i = 1; i < 32765; i++) {
      x = x + "X";
    }
    const data: any = { table1: [{ col1: x }] };

    adapter.request("common/sendArr", data).then((res: any) => {
      expect(res.table1[0][0]).to.not.be.undefined;
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      done();
    });
  });
  it("OBJ, long string (32765)", done => {
    let x = "X";
    for (var i = 1; i < 32765; i++) {
      x = x + "X";
    }
    const data: any = { table1: [{ col1: x }] };
    adapter.request("common/sendObj", data).then((res: any) => {
      expect(res.table1[0].COL1).to.not.be.undefined;
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      done();
    });
  });

  it("ARR, multiple columns", done => {
    const data: any = {
      table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }]
    };
    adapter.request("common/sendArr", data).then((res: any) => {
      expect(res.table1[0][0]).to.not.be.undefined;
      expect(res.table1[0][0]).to.be.equal(data.table1[0].col1);
      expect(res.table1[0][1]).to.be.equal(data.table1[0].col2);
      expect(res.table1[0][2]).to.be.equal(data.table1[0].col3);
      expect(res.table1[0][3]).to.be.equal(data.table1[0].col4);
      done();
    });
  });
  it("OBJ, multiple columns", done => {
    const data: any = {
      table1: [{ col1: 42, col2: 1.618, col3: "x", col4: "x" }]
    };
    adapter.request("common/sendObj", data).then((res: any) => {
      expect(res.table1[0].COL1).to.not.be.undefined;
      expect(res.table1[0].COL1).to.be.equal(data.table1[0].col1);
      expect(res.table1[0].COL2).to.be.equal(data.table1[0].col2);
      expect(res.table1[0].COL3).to.be.equal(data.table1[0].col3);
      expect(res.table1[0].COL4).to.be.equal(data.table1[0].col4);
      done();
    });
  });
});
