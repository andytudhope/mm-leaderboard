import React, { Component } from "react";
import "./App.css";

import { css } from "glamor";

import Web3 from "web3";

var myweb3 = new Web3();
window.web3 = myweb3

// const donationAddress = "0xf7050c2908b6c1ccdfb2a44b87853bcc3345e3b3"; //replace with the address to watch
const donationAddress = "0xf7050c2908b6c1ccdfb2a44b87853bcc3345e3b3"
const apiKey = "SC1H6JHAK19WC1D3BGV3JWIFD983E7BS58"; //replace with your own key

const SNTaddress = '0x744d70FDBE2Ba4CF95131626614a1763DF805B9E';
const DAIaddress = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359';
const MakerOracle = '0x729D19f657BD0614b4985Cf1D82531c67569197B';

const startBlock = 6710000;

const etherscanApiLinks = {
  intTx:
    "https://api.etherscan.io/api?module=account&action=txlist&address=" +
    donationAddress +
    "&startblock=" + startBlock + "&endblock=99999999&sort=asc&apikey=" +
    apiKey,
  ETHUSDoracle:
    "https://api.etherscan.io/api?module=proxy&action=eth_call&to=" +
    MakerOracle + "&data=0x59e02dd7&tag=latest&apikey=" +
    apiKey,
  SNTtxs:
    "https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=" + startBlock + "&toBlock=latest&address=" +
    SNTaddress + 
    "&topic0=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&" +
    "topic2=" + myweb3.eth.abi.encodeParameter('uint256', donationAddress) + "&apikey" +
    apiKey,
  DAItxs:
    "https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=" + startBlock + "&toBlock=latest&address=" +
    DAIaddress + 
    "&topic0=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&" +
    "topic2=" + myweb3.eth.abi.encodeParameter('uint256', donationAddress) + "&apikey=" +
    apiKey,
};

const isSearched = searchTerm => item =>
  item.from.toLowerCase().includes(searchTerm.toLowerCase());

const jsonFetch = url => fetch(url).then(res => res.json())
const bytes32ToAddress = x => myweb3.utils.toChecksumAddress(x.substr(26))
const weiToFixed = (value, decimals = 2) => parseFloat(myweb3.utils.fromWei(value.toString())).toFixed(decimals)

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      all: [],
      searchTerm: "",
      donateenabled: true,
      socketconnected: false,
      ETHtotal: 0,
      SNTtotal: 0,
      DAItotal: 0,
      USDETHValue: 0,
      USDSNTValue: 0
    };
  }

  onSearchChange = event => {
    this.setState({
      searchTerm: event.target.value
    });
  };

  getAccountData = async () => {
    let fetchCalls = [
      jsonFetch(`${etherscanApiLinks.intTx}`),
      jsonFetch(`${etherscanApiLinks.SNTtxs}`),
      jsonFetch(`${etherscanApiLinks.DAItxs}`),
    ];
    const responseJson = await Promise.all(fetchCalls);
    
    const ethusd = this.state.USDETHValue;
    const sntusd = this.state.USDSNTValue;
    
    const eth = responseJson[0].result
    .filter(x => x.txreceipt_status !== "0")
    .map(x => {
      return {
        from: myweb3.utils.toChecksumAddress(x.from),
        hash: x.hash,
        input: myweb3.utils.toAscii(x.input),
        value: x.value,
        type: 'ETH'
      }
    })
    const snt = responseJson[1].result
    .filter(x => x.txreceipt_status !== "0")
    .map(x => {
      return {
        from: bytes32ToAddress(x.topics[1]),
        hash: x.transactionHash,
        input: "",
        value: myweb3.utils.toBN(x.data).toString(),
        type: 'SNT'
      }
    })
    const dai = responseJson[2].result
    .filter(x => x.txreceipt_status !== "0")
    .map(x => {
      return {
        from: bytes32ToAddress(x.topics[1]),
        hash: x.transactionHash,
        input: "",
        value: myweb3.utils.toBN(x.data).toString(),
        type: 'DAI'
      }
    })

    let all = [].concat(eth, snt, dai).reduce((acc, cur) => {
      if (typeof acc[cur.from] === "undefined") {
        acc[cur.from] = {
          from: cur.from,
          input: "",
          ethValue: new myweb3.utils.BN(0),
          sntValue: new myweb3.utils.BN(0),
          daiValue: new myweb3.utils.BN(0),
          usdValue: 0,
          hash: []
        };
      }
      const type = cur.type.toLowerCase()
      const value = myweb3.utils.toBN(cur.value)
      acc[cur.from][`${type}Value`] = value.add(acc[cur.from][`${type}Value`])
      acc[cur.from].hash.push(cur.hash);
      if (cur.input) {
        acc[cur.from].input = cur.input
      }
      // Nasty, but works - must pass as string or BN to `fromWei` to avoid precision errors
      const eth_string = acc[cur.from].ethValue.toString()
      const snt_string = acc[cur.from].sntValue.toString()
      const dai_string = acc[cur.from].daiValue.toString()

      const eth = myweb3.utils.fromWei(eth_string)
      const snt = myweb3.utils.fromWei(snt_string)
      const dai = myweb3.utils.fromWei(dai_string)
      acc[cur.from].usdValue = (parseFloat(eth) * ethusd) + (parseFloat(snt) * sntusd) + parseFloat(dai)
      return acc
    },{})
    all = Object.keys(all)
      .map(val => all[val])
      .sort((a, b) => {
        // sort greatest to least
        // return myweb3.utils.toBN(b.usdValue).cmp(myweb3.utils.toBN(a.ethValue))
        return b.usdValue - a.usdValue;
      })
      .map((obj, index) => {
        // add rank
        obj.rank = index + 1;
        return obj;
      });
    const ETHtotal = eth.reduce((acc, cur) => {
      return acc.add(myweb3.utils.toBN(cur.value));
    }, new myweb3.utils.BN(0));
    const SNTtotal = snt.reduce((acc, cur) => {
      return acc.add(myweb3.utils.toBN(cur.value));
    }, new myweb3.utils.BN(0));
    const DAItotal = dai.reduce((acc, cur) => {
      return acc.add(myweb3.utils.toBN(cur.value));
    }, new myweb3.utils.BN(0));
    this.setState({ all, ETHtotal, SNTtotal, DAItotal })
  };

  getOracleData = async () => {
    const json = await jsonFetch(`${etherscanApiLinks.ETHUSDoracle}`);
    const json2 = await jsonFetch('https://api.coingecko.com/api/v3/coins/status?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false');
    const result = myweb3.eth.abi.decodeParameters(['uint256','bool'], json.result);
    const USDETHValue = result[1] ? myweb3.utils.fromWei(result[0]) : "Oracle False";
    this.setState({ 
      USDETHValue,
      USDSNTValue: json2.market_data.current_price.usd
    });
  }

  componentDidMount = async () => {
    await this.getOracleData();
    this.getAccountData();
  };

  render = () => {

    const responsiveness = css({
      "@media(max-width: 700px)": {
        "flexWrap": "wrap"
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
                  <li>{weiToFixed(this.state.ETHtotal.toString())} ETH</li>
                  <li>{weiToFixed(this.state.SNTtotal.toString())} SNT </li>
                  <li>{weiToFixed(this.state.DAItotal.toString())} DAI</li>
                </ul>
                <h6>
                  {parseFloat(this.state.USDETHValue).toFixed(2)} USD/ETH Rate
                </h6>
                <h6>
                  {parseFloat(this.state.USDSNTValue).toFixed(4)} USD/SNT Rate
                </h6>
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
          {this.state.all
            .filter(isSearched(this.state.searchTerm))
            .map(item => (
              <div key={item.hash} className="donation-row">
                <div className="rank">
                  <b>{item.rank}</b>
                </div>
                <p>
                  {item.from} donated 
                  {item.ethValue.gt(myweb3.utils.toBN(0)) && 
                    <b> {weiToFixed(item.ethValue)} ETH </b>
                  }
                  {item.sntValue.gt(myweb3.utils.toBN(0)) && 
                    <b> {weiToFixed(item.sntValue)} SNT </b>
                  }
                  {item.daiValue.gt(myweb3.utils.toBN(0)) && 
                    <b> {weiToFixed(item.daiValue)} DAI </b>
                  }
                  for a total of <b>{item.usdValue.toFixed(2)} USD </b>
                  {item.hash.map((txHash, index) => (
                    <a
                      key={index}
                      href={"https://etherscan.io/tx/" + txHash}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      [{index + 1}]
                    </a>
                  ))}
                </p>
                {item.input && 
                <p className="message">
                  {item.input}
                </p>
                }
              </div>
            ))}
        </div>
      </div>
    );
  }; // End of render()
} // End of class App extends Component

export default App;
