import React, { Component } from "react";
import "./App.css";

import { css } from "glamor";

import Web3 from "web3";

import Emojify from "react-emojione";

const donationNetworkID = 1; // make sure donations only go through on this network.

const donationAddress = "0xc31fcE79a354E027F49501C609cF3BD3B12cEAE7"; //replace with the address to watch
const apiKey = "SC1H6JHAK19WC1D3BGV3JWIFD983E7BS58"; //replace with your own key

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
    apiKey
};

const isSearched = searchTerm => item =>
  item.from.toLowerCase().includes(searchTerm.toLowerCase());

var myweb3;

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ethlist: [],
      searchTerm: "",
      donateenabled: true,
      socketconnected: false,
      totalAmount: 0
    };
  }

  onSearchChange = event => {
    this.setState({
      searchTerm: event.target.value
    });
  };

  subscribe = address => {
    let ws = new WebSocket("wss://socket.etherscan.io/wshandler");

    function pinger(ws) {
      var timer = setInterval(function() {
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              event: "ping"
            })
          );
        }
      }, 20000);
      return {
        stop: function() {
          clearInterval(timer);
        }
      };
    }

    ws.onopen = function() {
      this.setState({
        socketconnected: true
      });
      pinger(ws);
      ws.send(
        JSON.stringify({
          event: "txlist",
          address: address
        })
      );
    }.bind(this);
    ws.onmessage = function(evt) {
      let eventData = JSON.parse(evt.data);
      console.log(eventData);
      if (eventData.event === "txlist") {
        let newTransactionsArray = this.state.transactionsArray.concat(
          eventData.result
        );
        this.setState(
          {
            transactionsArray: newTransactionsArray
          },
          () => {
            this.processEthList(newTransactionsArray);
          }
        );
      }
    }.bind(this);
    ws.onerror = function(evt) {
      this.setState({
        socketerror: evt.message,
        socketconnected: false
      });
    }.bind(this);
    ws.onclose = function() {
      this.setState({
        socketerror: "socket closed",
        socketconnected: false
      });
    }.bind(this);
  };

  getAccountData = () => {
    let fetchCalls = [
      fetch(`${etherscanApiLinks.extTx}`),
      fetch(`${etherscanApiLinks.intTx}`)
    ];
    return Promise.all(fetchCalls)
      .then(res => {
        return Promise.all(res.map(apiCall => apiCall.json()));
      })
      .then(responseJson => {
        return [].concat.apply(...responseJson.map(res => res.result));
      });
  };

  handleDonate = event => {
    event.preventDefault();
    const form = event.target;
    let donateWei = new myweb3.utils.BN(
      myweb3.utils.toWei(form.elements["amount"].value, "ether")
    );
    let message = myweb3.utils.toHex(form.elements["message"].value);
    let extraGas = form.elements["message"].value.length * 68;

    myweb3.eth.net.getId().then(netId => {
      switch (netId) {
        case 1:
          console.log("Metamask is on mainnet");
          break;
        case 2:
          console.log("Metamask is on the deprecated Morden test network.");
          break;
        case 3:
          console.log("Metamask is on the ropsten test network.");
          break;
        case 4:
          console.log("Metamask is on the Rinkeby test network.");
          break;
        case 42:
          console.log("Metamask is on the Kovan test network.");
          break;
        default:
          console.log("Metamask is on an unknown network.");
      }
      if (netId === donationNetworkID) {
        return myweb3.eth.getAccounts().then(accounts => {
          return myweb3.eth
            .sendTransaction({
              from: accounts[0],
              to: donationAddress,
              value: donateWei,
              gas: 150000 + extraGas,
              data: message
            })
            .catch(e => {
              console.log(e);
            });
        });
      } else {
        console.log("no donation allowed on this network");
        this.setState({
          donateenabled: false
        });
      }
    });
  };

  processEthList = ethlist => {
    // let totalAmount = new myweb3.utils.BN(0);
    let filteredEthList = ethlist
      .map(obj => {
        obj.value = new myweb3.utils.BN(obj.value); // convert string to BigNumber
        return obj;
      })
      .filter(obj => {
        return obj.value.cmp(new myweb3.utils.BN(0));
      }) // filter out zero-value transactions
      .reduce((acc, cur) => {
        // group by address and sum tx value
        if (cur.isError !== "0") {
          // tx was not successful - skip it.
          return acc;
        }
        if (cur.from === donationAddress) {
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
    if (
      typeof window.web3 !== "undefined" &&
      typeof window.web3.currentProvider !== "undefined"
    ) {
      myweb3 = new Web3(window.web3.currentProvider);
      myweb3.eth.defaultAccount = window.web3.eth.defaultAccount;
      this.setState({
        candonate: true
      });
    } else {
      // I cannot do transactions now.
      this.setState({
        candonate: false
      });
      myweb3 = new Web3();
    }

    this.getAccountData().then(res => {
      this.setState(
        {
          transactionsArray: res
        },
        () => {
          this.processEthList(res);
          this.subscribe(donationAddress);
        }
      );
    });
  };

  render = () => {
    const candonate = this.state.candonate;

    const responsiveness = css({
      "@media(max-width: 700px)": {
        "flex-wrap": "wrap"
      }
    });

    const hiddenOnMobile = css({
      "@media(max-width: 700px)": {
        display: "none"
      }
    });

    return (
      <div className="App container-fluid">
        <div
          {...responsiveness}
          className="flex-row d-flex justify-content-around"
        >
          <div className="flex-column introColumn">
            <img
              src="/img/supports.pngc"
              className="typelogo img-fluid"
              alt="Banner Placeholder"
            />
            <div className="introContainer">
              <h1>Ellicott City Flood Donation Leaderboard</h1>
              <h4>
                The Bitcoin Podcast Network wants to help the victims of the recent Ellicott City flood, and needs your help to do it.
              </h4>
              <h4>
                {`For those that are unaware, on Sunday, May 27, 2018, Historic Ellicott City experienced another devastating flood that destroyed many local businesses and patron's property.  A quick `}
                <a href="https://www.youtube.com/results?search_query=ellicott+city+flood"> youtube search</a>
                {` will reveal the carnage that started within minutes.`} 
              </h4>
              <h4>
                We're asking you to give what you can, and put yourself on the leaderboard of contributors.  Help Ellicott City get back on its feet.
              </h4>
              <h4>
                {`All funds will go to the `}
                <a href="https://cfhoco.org/">Community Foundation of Howard County</a>
                {` relief fund.  If you feel more comfortable donating directly through their website, then please do.  This leaderboard is an attempt to let the crypto community contribute directly.`}
              </h4>
              <hr/>
              <h6>
                Funds disbursement will be handled by Corey Petty on behalf of The Bitcion Podcast Network. He previously lived within walking distance of the flood path, and personally knows many who have suffered from this disaster.
              </h6>
              <h6>
                {`Forked with <3 from the Unicorns at `}
                <a href="https://giveth.io">Giveth</a>
              </h6>
              <h6>
                NOTE: ERC20 tokens will be accepted but will not show up on the leaderboard.
              </h6>
            </div>

            <div {...responsiveness} className="flex-row d-flex amount">
              <div className="flex-column margin">
                <strong>Amount donated </strong>
                <h3>{this.state.totalAmount} ETH</h3>
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

          <div className="flex-column donationColumn">
            <img src="/img/ways-to-donate.svg" className="typelogo img-fluid" />
            {candonate ? (
              <div className="donation">
                <h4 {...hiddenOnMobile}>
                  Publicly: Send a transaction via Metamask with your name (or something else)
                  as a message{" "}
                </h4>
                <h4>
                  All donations with the same address will be added together.
                </h4>

                <form {...hiddenOnMobile} onSubmit={this.handleDonate}>
                  <input
                    type="text"
                    placeholder="ETH to donate"
                    name="amount"
                  />
                  <input type="text" placeholder="message" name="message" />
                  <button className="btn btn-primary donation-button">Send</button>
                </form>
              </div>
            ) : (
              <br />
            )}
            <hr />
            <h4>Privately: Send directly to the donation address</h4>
            <img src="/img/Address-QR.png" className="qr-code" />
            <div className="word-wrap">
              <strong>{donationAddress}</strong>
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
