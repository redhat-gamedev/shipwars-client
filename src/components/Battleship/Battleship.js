import { useEffect, useState, useRef } from "react";
import { connect } from "react-redux";
import AttackGrid from "./utilities/attackgrid";
import ShipGrid from "./utilities/shipgrid";
import Modal from "../Modal";
import { boardLocked, attack, bonus } from "./actions";
import target from "./images/target.svg";
import "./Battleship.scss";

/*
 * Ships not positioned:
 * - Show ship grid
 * - Hide enemy grid
 *
 * Ships positioned, waiting on enemy
 * - Show ship grid
 * - Hide enemy grid
 *
 * Ships positioned, your turn
 * - Show enemy grid
 * - Hide ship grid
 *
 * Ships positioned, enemy's turn
 * - Show ship grid
 * - Hide enemy grid
 */

// temporary fix. the initial configuration
// for ships should be coming from the socket
const ships = {
  "Submarine": {
    id: 0,
    origin: [0, 0]
  },
  "Destroyer": {
    id: 1,
    origin: [2, 2]
  },
  "Battleship": {
    id: 2,
    origin: [1, 1],
    orientation: "horizontal"
  },
  "Carrier": {
    id: 3,
    origin: [0, 4],
    orientation: "horizontal"
  }
};

let modalTimeout;

let attackGrid;
let shipGrid;

function Battleship({ game, board, player, opponent, boardLocked, attack, bonus, match, result, attacker }) {
  const attackGridRef = useRef();
  const shipGridRef = useRef();
  const [ disableAttacks, setDisableAttacks ] = useState(false);
  const [ turnModalHidden, setTurnModalHidden ] = useState({ hidden: true });
  const [ turnModalText, setTurnModalText ] = useState("");
  const [ positionModalHidden, setPositionModalHidden ] = useState({ hidden: true });
  const [ bonusModalHidden, setBonusModalHidden ] = useState({ hidden: true });
  const [ bonusHits, setBonusHits ] = useState(0);
  const bonusHitsRef = useRef(bonusHits);
  bonusHitsRef.current = bonusHits;
  const [ activeBoard, setActiveBoard ] = useState(null);
  const [ enemyShips, setEnemyShips ] = useState({
    "Submarine": {
      destroyed: false
    },
    "Destroyer": {
      destroyed: false
    },
    "Battleship": {
      destroyed: false
    },
    "Carrier": {
      destroyed: false
    }
  });

  // initial configuraton
  useEffect(() => {
    const shipGridLocked = player.board && player.board.positions && player.board.valid;
    const attackGridEnabled = shipGridLocked ? true : false;

    attackGrid = new AttackGrid({
      rows: board.rows,
      columns: board.columns,
      container: attackGridRef.current,
      initialState: {
        enabled: attackGridEnabled,
        attacks: player.attacks
      }
    });

    shipGrid = new ShipGrid({
      rows: board.rows,
      columns: board.columns,
      container: shipGridRef.current,
      initialState: {
        ships: (player.board) ? player.board.positions : ships,
        attacks: opponent.attacks,
        locked: shipGridLocked,
      }
    });

    setEnemyShips({
      "Submarine": {
        destroyed: false
      },
      "Destroyer": {
        destroyed: false
      },
      "Battleship": {
        destroyed: false
      },
      "Carrier": {
        destroyed: false
      }
    });
    document.addEventListener("shipgrid:locked", boardLockedHandler);
    document.addEventListener("attackgrid:attack", attackGridAttackHandler);
  }, []);

  // record the result of the last attack on
  // the attack grid
  useEffect(() => {
    if (!result) {
      // there wasn't an attack, we just need to
      // indicate who's turn it is.
      if (match.state.phase === 'not-ready') {
        setActiveBoard("ship");
        return;
      }

      modalTimeout = 1500;
      let activeModal;
      let isBonusRound = false;
      bonusHitsRef.current = bonusHits;

      if (player.uuid === match.state.activePlayer && match.state.phase === "attack") {
        setTurnModalText("Your turn");
        attackGrid.enabled = true;
        setDisableAttacks(false);
        setActiveBoard("attack");
        activeModal = setTurnModalHidden;
      } else if (player.uuid === match.state.activePlayer && match.state.phase === "bonus") {
        attackGrid.enabled = false;
        setDisableAttacks(true);
        setActiveBoard("attack");
      } else {
        setTurnModalText("Enemy's turn");
        attackGrid.enabled = false;
        setDisableAttacks(true);
        setActiveBoard("ship");
        activeModal = setTurnModalHidden;
      }

      if (activeModal) {
        activeModal(null);
      }

      setTimeout(() => {
        if (activeModal) {
          activeModal({ hidden: true });
        }
      }, modalTimeout);

      return;
    }

      result.position = {
        x: result.origin[0],
        y: result.origin[1]
      };

      // if the player is the attacker, record the result
      // on the attack grid. otherwise, record the incoming
      // attack on the shipgrid
      if (attacker === player.uuid) {
        attackGrid.recordAttack(result);
      } else {
        shipGrid.incomingAttack(result);
      }

      // if the attack destroyed a ship, record it.
      // @TODO: show interstitial animation
      if (result.destroyed) {
        if (player.uuid === match.state.activePlayer) {
          enemyShips[result.type].destroyed = true;
          setEnemyShips({...enemyShips});
          // alert(`You destroyed the ${result.type}`);
        } else {
          // alert(`Your ${result.type} was destroyed`);
        }
      }

      // wait for a short period before showing the
      // turn modal
      let activeModal;
      let isBonusRound = false;
      bonusHitsRef.current = bonusHits;

      setTimeout(() => {
        if (player.uuid === match.state.activePlayer && match.state.phase === "attack") {
          setTurnModalText("Your turn");
          attackGrid.enabled = true;
          setDisableAttacks(false);
          setActiveBoard("attack");
          activeModal = setTurnModalHidden;
        } else if (player.uuid === match.state.activePlayer && match.state.phase === "bonus") {
          // need to clean this up
        } else {
          setTurnModalText("Enemy's turn");
          attackGrid.enabled = false;
          setDisableAttacks(true);
          setActiveBoard("ship");
          activeModal = setTurnModalHidden;
        }

        if (activeModal) {
          activeModal(null);
        }

        setTimeout(() => {
          if (activeModal) {
            activeModal({ hidden: true });
          }
        }, modalTimeout);
      }, 1000);

  }, [ result, attacker, player, match ]);

  // show a modal if the player has not set up
  // their board yet
  useEffect(() => {
    if (player.board && player.board.valid) {
      setPositionModalHidden({ hidden: true });
    } else {
      setPositionModalHidden(null);

      setTimeout(() => {
        setPositionModalHidden({ hidden: true });
      }, modalTimeout);
    }
  }, [ player.board ]);

  useEffect(() => {
    if (!opponent || !opponent.board) {
      return;
    }

    Object.keys(opponent.board).forEach(key => {
      enemyShips[key].destroyed = true;
    });

    setEnemyShips({...enemyShips});
  }, [ opponent ]);

  // bonus round logic
  useEffect(() => {
    if (match.state.phase !== "bonus") {
      return;
    }

    setTimeout(() => {
      if (player.uuid === match.state.activePlayer) {
        bonus(bonusHitsRef.current);
        setBonusHits(0);
      }
    }, game.bonusDuration);
  }, [ game, match, player ]);

  function boardLockedHandler(event) {
    attackGrid.enabled = true;
    boardLocked(event.detail.ships);
  }

  function getFooterActionClasses() {
    let str = "ui-footer";

    if (match.state.phase === "not-ready") {
      if (!player.board.valid) {
        return `${str} ui-footer__action`;
      } else {
        return `${str} ui-footer__min`;
      }
    }

    if (match.state.phase === "bonus" && match.state.activePlayer === player.uuid) {
      return `${str} ui-footer__bonus`;
    }

    return `${str} ui-footer__min`;
  }

  function getActionButtonDisplay() {
    let display = "block";

    if (match.state.phase !== "not-ready" || (match.state.phase === "not-ready" && player.board.valid)) {
      display = "none";
    }

    return {
      display: display
    };
  }

  const attackGridAttackHandler = event => {
    console.log('attack event detail', event.detail)
    attack(event.detail);
  }

  return (
    <div className={ match.state.phase === "bonus" ? "Battleship bonus-round" : "Battleship"}>
      <div className={ activeBoard === "attack" ? "board-container" : "board-container hide" }>
        <div className="board push-bottom">
          <ul className="ui-progress">
          { Object.keys(enemyShips).map((enemyShipKey, index) => 
            <li key={ index }><input type="checkbox" disabled checked={ !!enemyShips[enemyShipKey].destroyed } />{ enemyShipKey }</li>
          )}
          </ul>
          <div id="attack-grid" className="ship-grid" ref={ attackGridRef }>
            <div className="bouy"></div>
            <div className="bouy"></div>
            <div className="bouy"></div>
            <div className="bouy"></div>
          </div>
          <footer className={ getFooterActionClasses() }>
            <div className="ui-footer-overlay"></div>
            <div className="ui-footer__screen-text-wrap">
              { match.state.phase === "attack" && match.state.activePlayer === player.uuid &&
                <span className="ui-footer__screen-text-scroll ui-screen-text">** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** ** Take a shot ** </span>
              }
              { match.state.phase === "bonus" && match.state.activePlayer === player.uuid &&
                <span className="ui-footer__screen-text-scroll ui-screen-text">** Bonus round!!! ** ** Bonus round!!! ** ** Bonus round!!! ** ** Bonus round!!! ** ** Bonus round!!! ** ** Bonus round!!! ** ** Bonus round!!! ** ** Bonus round!!! ** </span>
              }
            </div>
            <div className="ui-footer__bonus__sky"></div>
            <img src="images/ship-1.svg" className="ui-footer__bonus__ship" alt="" />
            <img src={ target } className="ui-footer__bonus__target" alt="" />
            <div className="ui-footer__bonus__water">{ bonusHits }</div>
            <button className="ui-footer__bonus__action" aria-label="fire" onClick={() => setBonusHits(bonusHits + 1)}></button>
          </footer>
        </div>
      </div>
      <div className={ activeBoard === "ship" ? "board-container" : "board-container hide" }>
        <div className="board">
          <div id="ship-grid" className="ship-grid" ref={ shipGridRef }>
            <div className="bouy"></div>
            <div className="bouy"></div>
            <div className="bouy"></div>
            <div className="bouy"></div>
          </div>
          <footer className={ getFooterActionClasses() }>
            <div className="ui-footer-overlay"></div>
            <div className="ui-footer__screen-text-wrap">
              { player.board && !player.board.valid && match.state.phase === "not-ready" &&
                <span className="ui-footer__screen-text-scroll ui-screen-text">** Position your ships ** ** Position your ships ** ** Position your ships ** ** Position your ships ** ** Position your ships ** ** Position your ships ** </span>
              }
              { player.board && player.board.valid && match.state.phase === "not-ready" &&
                <span className="ui-footer__screen-text-scroll ui-screen-text">** Waiting for enemy ** ** Waiting for enemy ** ** Waiting for enemy ** ** Waiting for enemy ** ** Waiting for enemy ** ** Waiting for enemy ** ** Waiting for enemy ** </span>
              }
              { match.state.phase === "attack" && match.state.activePlayer !== player.uuid &&
                <span className="ui-footer__screen-text-scroll ui-screen-text">** Incoming enemy attack ** ** Incoming enemy attack ** ** Incoming enemy attack ** ** Incoming enemy attack ** ** Incoming enemy attack ** ** Incoming enemy attack ** </span>
              }
            </div>
            <button className="ui-footer__btn unlock-message push-bottom" id="ship-grid-lock-btn" style={ getActionButtonDisplay() }>Ready!</button>
          </footer>
        </div>
      </div>
      <Modal { ...turnModalHidden }>
        <h2>{ turnModalText }</h2>
      </Modal>
      {/* <Modal { ...positionModalHidden }>
        <h2>Position your ships</h2>
      </Modal> */}
      {/* <Modal { ...bonusModalHidden }>
        <div>
          <h2>Bonus Round</h2>
          <button onClick={() => setBonusHits(bonusHits + 1)}>Click!!!</button>
          <div>{ bonusHits }</div>
        </div>
      </Modal> */}
    </div>
  );
}

const mapStateToProps = state => {
  return state;
}

const mapDispatchToProps = dispatch => {
  return {
    boardLocked: ships => {
      dispatch(boardLocked(ships));
    },
    attack: data => {
      dispatch(attack(data));
    },
    bonus: data => {
      console.log('sending bonus', data)
      dispatch(bonus(data));
    }
  }
};

export default connect(mapStateToProps, mapDispatchToProps)(Battleship);
