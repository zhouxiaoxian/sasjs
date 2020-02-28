/// <reference types="cypress" />
import SASjs from '../../../src/index';

const adapter = new SASjs({
    serverUrl: "",
    port: null,
    pathSAS9: "/SASStoredProcess/do",
    pathSASViya: "/SASJobExecution",
    appLoc: "/Public/app",
    serverType: "SASVIYA",
    debug: true
});

context('Preparing', () => {
    it('User login', (done) => {
        cy.visit("/SASLogon/login", {
            onLoad: function() {
                adapter.SASlogin("username", "password")
                .then(res => {
                    console.log(res);
                    expect("test").to.include("est");
                    done();
                })
                .catch(err => {
                    console.log(err);
                    expect("test").to.include("est");
                    done();
                });
            }
        });
    })
})
  