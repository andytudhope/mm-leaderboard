import React, { Component } from "react";
import "./App.css";

import { css } from "glamor";

import Web3 from "web3";

import Emojify from "react-emojione";

// const donationAddress = "0xf7050c2908b6c1ccdfb2a44b87853bcc3345e3b3"; //replace with the address to watch
const donationAddress = "0xf7050c2908b6c1ccdfb2a44b87853bcc3345e3b3"
const apiKey = "SC1H6JHAK19WC1D3BGV3JWIFD983E7BS58"; //replace with your own key

const SNTaddress = '0x744d70FDBE2Ba4CF95131626614a1763DF805B9E';
const DAIaddress = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359';

const MakerOracle = '0x729D19f657BD0614b4985Cf1D82531c67569197B';

const etherscanApiLinks = {
  extTx:
    "https://api.etherscan.io/api?module=account&action=txlistinternal&address=" +
    donationAddress +
    "&startblock=0&endblock=99999999&sort=asc&apikey=" +
    apiKey,
  intTx:
    "https://api.etherscan.io/api?module=account&action=txlist&address=" +
    donationAddress +
    "&startblock=0&endblock=99999999&sort=asc&apikey=" +
    apiKey,
  SNTbalance:
    "https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=" + 
    SNTaddress +
    "&address=" + 
    donationAddress + 
    "&tag=latest&apikey=" +
    apiKey,
  DAIbalance:
    "https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=" + 
    DAIaddress +
    "&address=" + 
    donationAddress + 
    "&tag=latest&apikey=" +
    apiKey,
};

const oracleABI = [{"constant":true,"inputs":[],"name":"peek","outputs":[{"name":"","type":"bytes32"},{"name":"","type":"bool"}],"payable":false,"type":"function"}]

const isSearched = searchTerm => item =>
  item.from.toLowerCase().includes(searchTerm.toLowerCase());

var myweb3 = new Web3();

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ethlist: [],
      searchTerm: "",
      donateenabled: true,
      socketconnected: false,
      totalAmount: 0,
      SNTtotal: 0,
      DAItotal: 0,
      USDtotal: 0
    };
  }

  onSearchChange = event => {
    this.setState({
      searchTerm: event.target.value
    });
  };

  getAccountData = () => {
    let fetchCalls = [
      fetch(`${etherscanApiLinks.extTx}`),
      fetch(`${etherscanApiLinks.intTx}`),
    ];
    return Promise.all(fetchCalls)
      .then(res => {
        return Promise.all(res.map(apiCall => apiCall.json()));
      })
      .then(responseJson => {
        return [].concat.apply(...responseJson.map(res => res.result));
      });
  };

  getTokenData = () => {
    let fetchTokenCalls = [
      fetch(`${etherscanApiLinks.SNTbalance}`),
      fetch(`${etherscanApiLinks.DAIbalance}`),
    ];
    return Promise.all(fetchTokenCalls)
      .then(res => {
        return Promise.all(res.map(apiCall => apiCall.json()));
      })
      .then(responseJson => {
        let token_balances = responseJson.map(res => res.result);
        let _SNTtotal = token_balances[0];
        let _DAItotal = token_balances[1];
        this.setState({
          SNTtotal: _SNTtotal,
          DAItotal: _DAItotal
        })
      })
  }

  getOracleData = () => {
    if (window.web3) {
      window.myweb3 = new Web3(window.web3.currentProvider);
    }
    // Non-dapp browsers...
    else {
      this.setState({
        USDtotal: 'Unavailable'
      })
    }
    // Get Oracle contract instance
    let contract = new window.myweb3.eth.Contract(oracleABI, MakerOracle);
    // call transfer function
    return contract.methods.peek().call()
      .then(res => {
        if (res[1]) {
          let usd = window.myweb3.utils.toAscii(res[0]);
          let _USDtotal = usd * this.state.totalAmount;
          this.setState({
            USDtotal: usd
          })
        } else {
          this.setState({
            USDtotal: "Oracle False"
          })
        }
      });
  }

  processEthList = ethlist => {
    // let totalAmount = new myweb3.utils.BN(0);
    let filteredEthList = ethlist
      .map(obj => {
        obj.value = new myweb3.utils.BN(obj.value); // convert string to BigNumber
        return obj;
      })
      // .filter(obj => {
      //   return obj.value.cmp(new myweb3.utils.BN(0));
      // }) // filter out zero-value transactions
      .reduce((acc, cur) => {
        // group by address and sum tx value
        // if (cur.isError !== "0") {
        //   // tx was not successful - skip it.
        //   return acc;
        // }
        if (cur.from === donationAddress.toLowerCase()) {
          // tx was outgoing - don't add it in
          return acc;
        }
        if (typeof acc[cur.from] === "undefined") {
          acc[cur.from] = {
            from: cur.from,
            value: new myweb3.utils.BN(0),
            input: cur.input,
            hash: []
          };
        }
        acc[cur.from].value = cur.value.add(acc[cur.from].value);
        acc[cur.from].input =
          cur.input !== "0x" && cur.input !== "0x00"
            ? cur.input
            : acc[cur.from].input;
        acc[cur.from].hash.push(cur.hash);
        return acc;
      }, {});
    filteredEthList = Object.keys(filteredEthList)
      .map(val => filteredEthList[val])
      .sort((a, b) => {
        // sort greatest to least
        return b.value.cmp(a.value);
      })
      .map((obj, index) => {
        // add rank
        obj.rank = index + 1;
        return obj;
      });
    const ethTotal = filteredEthList.reduce((acc, cur) => {
      return acc.add(cur.value);
    }, new myweb3.utils.BN(0));
    return this.setState({
      ethlist: filteredEthList,
      totalAmount: parseFloat(myweb3.utils.fromWei(ethTotal)).toFixed(2)
    });
  };

  componentDidMount = () => {

    this.getAccountData().then(res => {
      this.setState(
        {
          transactionsArray: res
        },
        () => {
          this.processEthList(res);
        }
      );
    });

    this.getTokenData();
    this.getOracleData();
  };

  render = () => {

    const responsiveness = css({
      "@media(max-width: 700px)": {
        "flex-wrap": "wrap"
      }
    });

    return (
      <div className="App container-fluid">
        <div {...responsiveness} className="flex-row d-flex justify-content-around">
          <div className="flex-column introColumn">
            <div {...responsiveness} className="flex-row d-flex amount">
              <div className="flex-column margin">
                <h3>Amount donated </h3>
                <div className="clear"></div>
                <ul>
                  <li>{this.state.totalAmount} ETH</li>
                  <li>{this.state.SNTtotal} SNT </li>
                  <li>{this.state.DAItotal} DAI</li>   
                </ul>
                <h3>{this.state.USDtotal} USD</h3> 
              </div>
              <div className="flex-column margin">
                <form className="Search">
                  <input
                    type="text"
                    onChange={this.onSearchChange}
                    placeholder="filter leaderboard"
                  />
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-column leaderboard">
          <table className="table">
            <thead className="pagination-centered">
              <tr>
                <th>Rank</th>
                <th>Address</th>
                <th>Value</th>
                <th>Message</th>
                <th>Tx Link</th>
              </tr>
            </thead>
            <tbody>
              {this.state.ethlist
                .filter(isSearched(this.state.searchTerm))
                .map(item => (
                  <tr key={item.hash} className="Entry">
                    <td>{item.rank} </td>
                    <td>{item.from} </td>
                    <td>{myweb3.utils.fromWei(item.value)} ETH</td>
                    <td>
                      <Emojify>
                        {item.input.length &&
                          myweb3.utils.hexToAscii(item.input)}
                      </Emojify>
                    </td>
                    <td className="table-tx-header">
                      {item.hash.map((txHash, index) => (
                        <a
                          key={index}
                          href={"https://etherscan.io/tx/" + txHash}
                        >
                          [{index + 1}]
                        </a>
                      ))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }; // End of render()
} // End of class App extends Component

export default App;
