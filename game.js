// GameState class - Core game state management
class GameState {
    constructor() {
        this.board = Array(14).fill(0);  // 14 cups (2 rows × 7 columns)
        this.stores = [0, 0];             // Captured counters for each player
        this.currentPlayer = 0;            // 0 or 1
        this.gameMode = null;              // 'single' or 'two-player'
        this.playerTypes = [null, null];   // 'human' or 'ai' for each player
        this.gameOver = false;
        this.winner = null;
    }

    // Initialize board with starting configuration
    initializeBoard() {
        // Place 12 counters in each cup except middle cups (indices 3 and 10)
        for (let i = 0; i < 14; i++) {
            if (i === 3 || i === 10) {
                this.board[i] = 2;  // Middle cups get 2 counters
            } else {
                this.board[i] = 12; // All other cups get 12 counters
            }
        }
        
        // Initialize empty stores
        this.stores = [0, 0];
        this.currentPlayer = 0;
        this.gameOver = false;
        this.winner = null;
    }

    // Initialize player types based on game mode
    initializePlayerTypes(mode) {
        if (mode === 'single') {
            // Single-player: Player 0 is human, Player 1 is AI
            this.playerTypes = ['human', 'ai'];
        } else if (mode === 'two-player') {
            // Two-player: Both players are human
            this.playerTypes = ['human', 'human'];
        }
    }

    // Get cup index for a given row and column
    getCupIndex(row, col) {
        if (row === 0) {
            return col;
        } else {
            return 7 + col;
        }
    }

    // Get row and column for a given cup index
    getCupPosition(index) {
        if (index < 7) {
            return { row: 0, col: index };
        } else {
            return { row: 1, col: index - 7 };
        }
    }

    // Check if a cup belongs to the current player
    isPlayerCup(cupIndex) {
        if (this.currentPlayer === 0) {
            return cupIndex >= 0 && cupIndex <= 6;
        } else {
            return cupIndex >= 7 && cupIndex <= 13;
        }
    }

    // Get total counters on the board
    getTotalCountersOnBoard() {
        return this.board.reduce((sum, count) => sum + count, 0);
    }

    // Clone the state for AI simulation
    clone() {
        const cloned = new GameState();
        cloned.board = [...this.board];
        cloned.stores = [...this.stores];
        cloned.currentPlayer = this.currentPlayer;
        cloned.gameMode = this.gameMode;
        cloned.playerTypes = [...this.playerTypes];
        cloned.gameOver = this.gameOver;
        cloned.winner = this.winner;
        return cloned;
    }
}

// MoveEngine class - Handles move execution and validation
class MoveEngine {
    // Check if a cup belongs to the specified player
    isPlayerCup(gameState, cupIndex, player) {
        if (player === 0) {
            return cupIndex >= 0 && cupIndex <= 6;
        } else {
            return cupIndex >= 7 && cupIndex <= 13;
        }
    }

    // Get all valid moves for the current player
    getValidMoves(gameState) {
        const validMoves = [];
        const player = gameState.currentPlayer;
        
        // Determine the range of cups for the current player
        const startIndex = player === 0 ? 0 : 7;
        const endIndex = player === 0 ? 6 : 13;
        
        // A cup is valid if it belongs to the player and has at least one counter
        for (let i = startIndex; i <= endIndex; i++) {
            if (gameState.board[i] > 0) {
                validMoves.push(i);
            }
        }
        
        return validMoves;
    }

    // Distribute counters counter-clockwise from a starting position
    // Returns the index of the cup where the last counter was placed
    distributeCounters(gameState, startIndex, count) {
        // Lift all counters from the starting cup
        gameState.board[startIndex] = 0;
        
        let currentIndex = startIndex;
        let lastIndex = startIndex;
        
        // Distribute counters one by one counter-clockwise
        for (let i = 0; i < count; i++) {
            // Move to next cup counter-clockwise (with wrapping)
            currentIndex = (currentIndex + 1) % 14;
            
            // Place one counter in this cup
            gameState.board[currentIndex]++;
            
            // Track where the last counter was placed
            lastIndex = currentIndex;
        }
        
        return lastIndex;
    }

    // Execute a complete move with continuation logic
    // Returns true if the move was valid and executed
    executeMove(gameState, cupIndex) {
        try {
            // Validate the move
            if (!this.isPlayerCup(gameState, cupIndex, gameState.currentPlayer)) {
                console.error(`[MOVE_ENGINE] Invalid move: Cup ${cupIndex} does not belong to player ${gameState.currentPlayer}.`);
                return false;
            }
            
            if (gameState.board[cupIndex] === 0) {
                console.error(`[MOVE_ENGINE] Invalid move: Cup ${cupIndex} is empty.`);
                return false;
            }
            
            // Prevent moves if the game is already over
            if (gameState.gameOver) {
                console.error('[MOVE_ENGINE] Invalid move: Game is already over.');
                return false;
            }
            
            // Start the move by distributing counters from the selected cup
            let lastCupIndex = this.distributeSingleRound(gameState, cupIndex);
            
            // Continue the move if the next cup has counters (not Saada)
            while (true) {
                // Get the next cup counter-clockwise from where the last counter landed
                const nextCupIndex = (lastCupIndex + 1) % 14;
                
                // Check if the next cup is empty (Saada)
                if (gameState.board[nextCupIndex] === 0) {
                    // Next cup is empty - check for capture and end the turn
                    this.checkCapture(gameState, lastCupIndex);
                    break;
                }
                
                // Next cup has counters - lift them and continue distribution
                lastCupIndex = this.distributeSingleRound(gameState, nextCupIndex);
            }
            
            // Check if the game has ended after this move
            this.checkGameEnd(gameState);
            
            return true;
        } catch (error) {
            console.error('[ERROR] Exception in executeMove:', error);
            return false;
        }
    }

    // Distribute counters from a single cup (helper for executeMove)
    // Returns the index where the last counter was placed
    distributeSingleRound(gameState, cupIndex) {
        const countersToDistribute = gameState.board[cupIndex];
        return this.distributeCounters(gameState, cupIndex, countersToDistribute);
    }

    // Check and execute capture if conditions are met
    // Returns the number of counters captured (0 if no capture)
    checkCapture(gameState, lastCupIndex) {
        // Get the next cup counter-clockwise from where the last counter landed
        const nextCupIndex = (lastCupIndex + 1) % 14;
        
        // Check if the next cup is empty
        if (gameState.board[nextCupIndex] !== 0) {
            // Next cup is not empty, no capture possible
            return 0;
        }
        
        // Next cup is empty, check the cup beyond it
        const cupBeyondEmpty = (nextCupIndex + 1) % 14;
        
        // Check if the cup beyond the empty cup is also empty (two consecutive empty cups)
        if (gameState.board[cupBeyondEmpty] === 0) {
            // Two consecutive empty cups - no capture
            return 0;
        }
        
        // Pattern detected: last counter → empty cup → cup with counters
        // Capture the counters from the cup beyond the empty cup
        const capturedCounters = gameState.board[cupBeyondEmpty];
        gameState.board[cupBeyondEmpty] = 0;
        gameState.stores[gameState.currentPlayer] += capturedCounters;
        
        return capturedCounters;
    }

    // Check if the game has ended (all cups are empty)
    // Returns true if the game is over, false otherwise
    checkGameEnd(gameState) {
        // Get total counters remaining on the board
        const totalCountersOnBoard = gameState.getTotalCountersOnBoard();
        
        // If all cups are empty, the game is over
        if (totalCountersOnBoard === 0) {
            gameState.gameOver = true;
            this.determineWinner(gameState);
            return true;
        }
        
        return false;
    }

    // Determine the winner by comparing store counts
    // Sets the winner property in gameState (0, 1, or 'tie')
    determineWinner(gameState) {
        const store0 = gameState.stores[0];
        const store1 = gameState.stores[1];
        
        if (store0 > store1) {
            gameState.winner = 0;
        } else if (store1 > store0) {
            gameState.winner = 1;
        } else {
            // Both stores have equal counts - it's a tie
            gameState.winner = 'tie';
        }
    }
}

// BoardRenderer class - Handles visual representation of the game board
class BoardRenderer {
    constructor(containerElement) {
        this.container = containerElement;
        this.cupsContainer = null;
        this.store0Element = null;
        this.store1Element = null;
    }

    // Render the complete board
    render(gameState) {
        // Cache DOM element references if not already cached
        if (!this.cupsContainer) {
            this.cupsContainer = document.getElementById('cups-container');
            this.store0Element = document.getElementById('store-0');
            this.store1Element = document.getElementById('store-1');
        }

        // Render all 14 cups in circular arrangement
        this.cupsContainer.innerHTML = '';
        for (let cupIndex = 0; cupIndex < 14; cupIndex++) {
            const cup = this.createCupElement(cupIndex, gameState.board[cupIndex]);
            this.cupsContainer.appendChild(cup);
        }
        
        // Update stores
        this.updateCounters(gameState);
    }

    // Update counter counts without full re-render
    updateCounters(gameState) {
        try {
            // Use requestAnimationFrame for optimal DOM updates
            requestAnimationFrame(() => {
                // Batch DOM reads and writes for better performance
                const updates = [];
                
                // Collect all updates first (read phase)
                const cups = document.querySelectorAll('.cup');
                const cupsLength = cups.length;
                
                for (let i = 0; i < cupsLength; i++) {
                    const cup = cups[i];
                    const cupIndex = parseInt(cup.dataset.index);
                    const newValue = gameState.board[cupIndex];
                    const currentValue = cup.textContent;
                    
                    // Only update if value changed
                    if (currentValue !== String(newValue)) {
                        updates.push({ element: cup, value: newValue });
                    }
                }
                
                // Check stores and update colors based on scores
                const store0Score = gameState.stores[0];
                const store1Score = gameState.stores[1];
                
                if (this.store0Element) {
                    const newValue = store0Score;
                    const currentValue = this.store0Element.textContent;
                    if (currentValue !== String(newValue)) {
                        updates.push({ element: this.store0Element, value: newValue });
                    }
                    
                    // Update color classes based on score comparison
                    this.updateStoreColors(this.store0Element, store0Score, store1Score);
                }
                
                if (this.store1Element) {
                    const newValue = store1Score;
                    const currentValue = this.store1Element.textContent;
                    if (currentValue !== String(newValue)) {
                        updates.push({ element: this.store1Element, value: newValue });
                    }
                    
                    // Update color classes based on score comparison
                    this.updateStoreColors(this.store1Element, store1Score, store0Score);
                }
                
                // Apply all updates (write phase) - batch for better performance
                const updatesLength = updates.length;
                for (let i = 0; i < updatesLength; i++) {
                    updates[i].element.textContent = updates[i].value;
                }
            });
        } catch (error) {
            console.error('[ERROR] Exception in updateCounters:', error);
        }
    }
    
    // Update store color classes based on score comparison
    updateStoreColors(storeElement, myScore, opponentScore) {
        // Remove all score-related classes
        storeElement.classList.remove('leading', 'lagging', 'tied');
        
        // Add appropriate class based on score comparison
        if (myScore > opponentScore) {
            storeElement.classList.add('leading');
        } else if (myScore < opponentScore) {
            storeElement.classList.add('lagging');
        } else {
            storeElement.classList.add('tied');
        }
    }

    // Highlight selectable cups for the current player
    highlightSelectableCups(gameState) {
        try {
            // Use requestAnimationFrame for optimal DOM updates
            requestAnimationFrame(() => {
                const cups = document.querySelectorAll('.cup');
                const moveEngine = new MoveEngine();
                const validMoves = moveEngine.getValidMoves(gameState);
                
                // Convert validMoves to a Set for O(1) lookup
                const validMovesSet = new Set(validMoves);
                
                // Batch DOM updates - use for loop for better performance
                const cupsLength = cups.length;
                for (let i = 0; i < cupsLength; i++) {
                    const cup = cups[i];
                    const cupIndex = parseInt(cup.dataset.index);
                    const isValid = validMovesSet.has(cupIndex);
                    
                    // Only update classes if they need to change
                    const hasSelectable = cup.classList.contains('selectable');
                    const hasDisabled = cup.classList.contains('disabled');
                    
                    if (isValid && !hasSelectable) {
                        cup.classList.remove('disabled');
                        cup.classList.add('selectable');
                    } else if (!isValid && !hasDisabled) {
                        cup.classList.remove('selectable');
                        cup.classList.add('disabled');
                    }
                }
            });
        } catch (error) {
            console.error('[ERROR] Exception in highlightSelectableCups:', error);
        }
    }

    // Clear all highlights
    clearHighlights() {
        const cups = document.querySelectorAll('.cup');
        cups.forEach(cup => {
            cup.classList.remove('selectable', 'disabled', 'active');
        });
    }

    // Show winner overlay
    showWinner(winner) {
        const overlay = document.getElementById('winner-overlay');
        const message = document.querySelector('.winner-message');
        
        if (winner === 'tie') {
            message.textContent = "It's a Tie!";
        } else {
            message.textContent = `Player ${winner + 1} Wins!`;
        }
        
        overlay.style.display = 'flex';
    }

    // Create a cup element
    createCupElement(cupIndex, counterCount) {
        const cup = document.createElement('div');
        cup.className = 'cup';
        cup.dataset.index = cupIndex;
        cup.textContent = counterCount;
        return cup;
    }
}

// AIPlayer class - Implements computer opponent strategy
class AIPlayer {
    constructor() {
        this.moveEngine = new MoveEngine();
    }

    // Get all valid moves for the current player
    getValidMoves(gameState) {
        return this.moveEngine.getValidMoves(gameState);
    }

    // Select the best move for the AI using a greedy strategy
    selectMove(gameState) {
        const validMoves = this.getValidMoves(gameState);
        
        // If no valid moves, return null
        if (validMoves.length === 0) {
            return null;
        }
        
        // If only one valid move, return it
        if (validMoves.length === 1) {
            return validMoves[0];
        }
        
        // Evaluate each valid move and select the best one
        let bestMove = validMoves[0];
        let bestScore = -Infinity;
        
        for (const move of validMoves) {
            // Simulate the move on a cloned state
            const simulatedState = this.simulateMove(gameState, move);
            
            // Evaluate the resulting state
            const score = this.evaluateState(simulatedState, gameState.currentPlayer);
            
            // Update best move if this score is better
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    // Simulate a move and return the resulting state
    simulateMove(gameState, cupIndex) {
        // Clone the state to avoid modifying the original
        const clonedState = gameState.clone();
        
        // Execute the move on the cloned state
        this.moveEngine.executeMove(clonedState, cupIndex);
        
        return clonedState;
    }

    // Evaluate a game state using a heuristic scoring function
    // Higher scores are better for the AI player
    evaluateState(gameState, aiPlayer) {
        // Calculate store difference (AI store - opponent store)
        const aiStore = gameState.stores[aiPlayer];
        const opponentStore = gameState.stores[1 - aiPlayer];
        const storeDifference = aiStore - opponentStore;
        
        // Calculate counters on AI's side vs opponent's side
        const aiSideStart = aiPlayer === 0 ? 0 : 7;
        const aiSideEnd = aiPlayer === 0 ? 6 : 13;
        const opponentSideStart = aiPlayer === 0 ? 7 : 0;
        const opponentSideEnd = aiPlayer === 0 ? 13 : 6;
        
        let aiSideCounters = 0;
        for (let i = aiSideStart; i <= aiSideEnd; i++) {
            aiSideCounters += gameState.board[i];
        }
        
        let opponentSideCounters = 0;
        for (let i = opponentSideStart; i <= opponentSideEnd; i++) {
            opponentSideCounters += gameState.board[i];
        }
        
        // Heuristic scoring:
        // - Store difference is most important (weight: 10)
        // - Having counters on AI's side is good (weight: 1)
        // - Having fewer counters on opponent's side is good (weight: -0.5)
        const score = storeDifference * 10 + aiSideCounters * 1 - opponentSideCounters * 0.5;
        
        return score;
    }
}

// AnimationController class - Manages smooth counter movement animations
class AnimationController {
    constructor(boardRenderer) {
        this.boardRenderer = boardRenderer;
        this.animationSpeed = 5; // Default to slower speed for better visibility
        this.isAnimatingFlag = false;
    }

    // Animate counter distribution from one cup to another
    // fromCup: starting cup index
    // toCup: destination cup index
    // callback: function to call when animation completes
    animateDistribution(fromCup, toCup, callback) {
        try {
            // Validate inputs
            if (typeof fromCup !== 'number' || fromCup < 0 || fromCup > 13) {
                console.error(`[ANIMATION] Invalid fromCup: ${fromCup}`);
                if (callback) callback();
                return;
            }
            
            if (typeof toCup !== 'number' || toCup < 0 || toCup > 13) {
                console.error(`[ANIMATION] Invalid toCup: ${toCup}`);
                if (callback) callback();
                return;
            }
            
            this.isAnimatingFlag = true;
            
            // Get the cup elements
            const fromElement = document.querySelector(`.cup[data-index="${fromCup}"]`);
            const toElement = document.querySelector(`.cup[data-index="${toCup}"]`);
            
            if (!fromElement || !toElement) {
                console.error(`[ANIMATION] Cup elements not found: fromCup=${fromCup}, toCup=${toCup}`);
                this.isAnimatingFlag = false;
                if (callback) callback();
                return;
            }
            
            // Add active class to the destination cup for visual feedback
            toElement.classList.add('active');
            
            // Calculate animation duration based on speed setting
            const baseDuration = 100; // milliseconds per speed unit
            const duration = this.animationSpeed === 0 ? 0 : baseDuration * this.animationSpeed;
            
            if (duration === 0) {
                // Instant mode - no animation
                toElement.classList.remove('active');
                this.isAnimatingFlag = false;
                if (callback) callback();
                return;
            }
            
            // Create a visual counter element for animation
            const counter = document.createElement('div');
            counter.className = 'animated-counter';
            counter.style.cssText = `
                position: fixed;
                width: 30px;
                height: 30px;
                background: radial-gradient(circle, #ffd700 0%, #ffed4e 100%);
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(255, 215, 0, 0.6), 0 0 20px rgba(255, 215, 0, 0.4);
                pointer-events: none;
                z-index: 1000;
                will-change: transform;
            `;
            
            // Get positions for animation
            const fromRect = fromElement.getBoundingClientRect();
            const toRect = toElement.getBoundingClientRect();
            
            // Set initial position using transform for better performance
            const startX = fromRect.left + fromRect.width / 2 - 15;
            const startY = fromRect.top + fromRect.height / 2 - 15;
            const endX = toRect.left + toRect.width / 2 - 15;
            const endY = toRect.top + toRect.height / 2 - 15;
            
            counter.style.left = '0px';
            counter.style.top = '0px';
            counter.style.transform = `translate(${startX}px, ${startY}px) scale(1.2)`;
            counter.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
            
            document.body.appendChild(counter);
            
            // Use requestAnimationFrame to ensure the initial position is rendered
            requestAnimationFrame(() => {
                // Animate to destination using transform
                counter.style.transform = `translate(${endX}px, ${endY}px) scale(1)`;
                
                // Clean up after animation
                setTimeout(() => {
                    counter.remove();
                    toElement.classList.remove('active');
                    this.isAnimatingFlag = false;
                    if (callback) callback();
                }, duration);
            });
        } catch (error) {
            console.error('[ERROR] Exception in animateDistribution:', error);
            this.isAnimatingFlag = false;
            if (callback) callback();
        }
    }

    // Animate capture - counters moving from a cup to a player's store
    // fromCup: cup index where counters are being captured from
    // toStore: player index (0 or 1) whose store receives the counters
    // count: number of counters being captured
    // callback: function to call when animation completes
    animateCapture(fromCup, toStore, count, callback) {
        try {
            // Validate inputs
            if (typeof fromCup !== 'number' || fromCup < 0 || fromCup > 13) {
                console.error(`[ANIMATION] Invalid fromCup: ${fromCup}`);
                if (callback) callback();
                return;
            }
            
            if (typeof toStore !== 'number' || (toStore !== 0 && toStore !== 1)) {
                console.error(`[ANIMATION] Invalid toStore: ${toStore}`);
                if (callback) callback();
                return;
            }
            
            if (typeof count !== 'number' || count <= 0) {
                console.error(`[ANIMATION] Invalid count: ${count}`);
                if (callback) callback();
                return;
            }
            
            this.isAnimatingFlag = true;
            
            // Get the cup element and store element
            const fromElement = document.querySelector(`.cup[data-index="${fromCup}"]`);
            const toElement = document.getElementById(`store-${toStore}`);
            
            if (!fromElement || !toElement) {
                console.error(`[ANIMATION] Elements not found: fromCup=${fromCup}, toStore=${toStore}`);
                this.isAnimatingFlag = false;
                if (callback) callback();
                return;
            }
            
            // Calculate animation duration based on speed setting
            const baseDuration = 500; // milliseconds for capture animation
            const duration = this.animationSpeed === 0 ? 0 : baseDuration * this.animationSpeed;
            
            if (duration === 0) {
                // Instant mode - no animation
                this.isAnimatingFlag = false;
                if (callback) callback();
                return;
            }
            
            // Animate multiple counters with slight delays
            let completedAnimations = 0;
            const delayBetweenCounters = 50; // milliseconds
            
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    this.animateSingleCapture(fromElement, toElement, duration, () => {
                        completedAnimations++;
                        if (completedAnimations === count) {
                            this.isAnimatingFlag = false;
                            if (callback) callback();
                        }
                    });
                }, i * delayBetweenCounters);
            }
        } catch (error) {
            console.error('[ERROR] Exception in animateCapture:', error);
            this.isAnimatingFlag = false;
            if (callback) callback();
        }
    }

    // Helper method to animate a single counter capture
    animateSingleCapture(fromElement, toElement, duration, callback) {
        // Create a visual counter element for animation
        const counter = document.createElement('div');
        counter.className = 'animated-counter';
        counter.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, #ffd700 0%, #ffed4e 100%);
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: none;
            z-index: 1000;
            will-change: transform;
        `;
        
        // Get positions for animation
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();
        
        // Set initial position using transform for better performance
        const startX = fromRect.left + fromRect.width / 2 - 10;
        const startY = fromRect.top + fromRect.height / 2 - 10;
        const endX = toRect.left + toRect.width / 2 - 10;
        const endY = toRect.top + toRect.height / 2 - 10;
        
        counter.style.left = '0px';
        counter.style.top = '0px';
        counter.style.transform = `translate(${startX}px, ${startY}px) scale(1)`;
        counter.style.transition = `transform ${duration}ms ease-in-out`;
        
        document.body.appendChild(counter);
        
        // Use requestAnimationFrame to ensure the initial position is rendered
        requestAnimationFrame(() => {
            // Animate to destination with a slight scale effect using transform
            counter.style.transform = `translate(${endX}px, ${endY}px) scale(0.5)`;
            
            // Clean up after animation
            setTimeout(() => {
                counter.remove();
                if (callback) callback();
            }, duration);
        });
    }

    // Set animation speed
    // speed: 0 = instant, 1 = normal, 2 = slow
    setSpeed(speed) {
        this.animationSpeed = speed;
    }

    // Check if animation is currently running
    isAnimating() {
        return this.isAnimatingFlag;
    }
}

// GameController class - Orchestrates game flow and user interaction
class GameController {
    constructor() {
        this.gameState = new GameState();
        this.moveEngine = new MoveEngine();
        this.boardRenderer = null;
        this.animationController = null;
        this.modeSelectionElement = null;
        this.gameBoardElement = null;
        this.aiPlayer = new AIPlayer();
        
        // Step-by-step mode properties
        this.stepMode = false;
        this.pendingAnimationSteps = [];
        this.currentStepIndex = 0;
        this.stepCallback = null;
    }

    // Initialize a new game with the specified mode
    startGame(mode) {
        try {
            // Validate mode
            if (mode !== 'single' && mode !== 'two-player') {
                console.error(`[ERROR] Invalid game mode: ${mode}. Must be 'single' or 'two-player'.`);
                this.showErrorMessage('Invalid game mode');
                return;
            }
            
            console.log(`[GAME] Starting new game in ${mode} mode.`);
            
            // Set the game mode
            this.gameState.gameMode = mode;
            
            // Initialize player types based on mode
            this.gameState.initializePlayerTypes(mode);
            
            // Initialize the board with starting configuration
            this.gameState.initializeBoard();
            
            console.log('[GAME] Board initialized:', {
                totalCounters: this.gameState.getTotalCountersOnBoard(),
                stores: this.gameState.stores
            });
            
            // Hide mode selection and show game board
            if (this.modeSelectionElement) {
                this.modeSelectionElement.style.display = 'none';
            }
            if (this.gameBoardElement) {
                this.gameBoardElement.style.display = 'flex';
            }
            
            // Show animation settings
            const animationSettings = document.getElementById('animation-settings');
            if (animationSettings) {
                animationSettings.style.display = 'block';
            }
            
            // Setup step mode controls
            this.setupStepModeControls();
            
            // Render the board
            if (this.boardRenderer) {
                this.boardRenderer.render(this.gameState);
                this.boardRenderer.highlightSelectableCups(this.gameState);
            }
            
            // Update turn indicator
            this.updateTurnIndicator();
            
            // If the first player is AI, trigger AI turn
            if (this.gameState.playerTypes[this.gameState.currentPlayer] === 'ai') {
                this.executeAITurn();
            }
        } catch (error) {
            console.error('[ERROR] Exception in startGame:', error);
            this.showErrorMessage('Failed to start game. Please try again.');
        }
    }

    // Handle cup selection by player
    handleCupClick(cupIndex) {
        try {
            // Validate cup index
            if (typeof cupIndex !== 'number' || cupIndex < 0 || cupIndex > 13) {
                console.error(`[ERROR] Invalid cup index: ${cupIndex}. Must be between 0 and 13.`);
                this.showErrorMessage('Invalid cup selection');
                return;
            }
            
            // Prevent moves if game is over
            if (this.gameState.gameOver) {
                console.log('[INFO] Move blocked: Game is already over.');
                this.showErrorMessage('Game is over. Please start a new game.');
                return;
            }
            
            // Prevent moves during AI turn
            if (this.gameState.playerTypes[this.gameState.currentPlayer] === 'ai') {
                console.log('[INFO] Move blocked: It is the AI\'s turn.');
                this.showErrorMessage('Please wait for the AI to make its move');
                return;
            }
            
            // Prevent moves during animation
            if (this.animationController && this.animationController.isAnimating()) {
                console.log('[INFO] Move blocked: Animation in progress.');
                this.showErrorMessage('Please wait for the animation to complete');
                return;
            }
            
            // Validate the move before executing
            if (!this.moveEngine.isPlayerCup(this.gameState, cupIndex, this.gameState.currentPlayer)) {
                console.log(`[INFO] Invalid move: Cup ${cupIndex} does not belong to Player ${this.gameState.currentPlayer + 1}.`);
                this.showErrorMessage('Please select a cup on your side');
                return;
            }
            
            if (this.gameState.board[cupIndex] === 0) {
                console.log(`[INFO] Invalid move: Cup ${cupIndex} is empty.`);
                this.showErrorMessage('Please select a cup with counters');
                return;
            }
            
            console.log(`[MOVE] Player ${this.gameState.currentPlayer + 1} selected cup ${cupIndex} with ${this.gameState.board[cupIndex]} counters.`);
            
            // Execute the move with animations
            this.executeMoveWithAnimation(cupIndex);
        } catch (error) {
            console.error('[ERROR] Exception in handleCupClick:', error);
            this.showErrorMessage('An error occurred. Please try again.');
        }
    }
    
    // Execute a move with animations
    executeMoveWithAnimation(cupIndex) {
        try {
            // Clone the state to simulate the move
            const simulatedState = this.gameState.clone();
            
            // Execute the move on simulated state to validate and get the result
            const moveSuccessful = this.moveEngine.executeMove(simulatedState, cupIndex);
            
            if (!moveSuccessful) {
                console.error(`[ERROR] Move execution failed for cup ${cupIndex}.`);
                this.showErrorMessage('Move execution failed. Please try again.');
                return;
            }
            
            console.log(`[MOVE] Move validated. Starting animation from cup ${cupIndex}.`);
            
            // Now animate the move step by step on the real state
            this.animateMoveStepByStep(cupIndex);
        } catch (error) {
            console.error('[ERROR] Exception in executeMoveWithAnimation:', error);
            this.showErrorMessage('An error occurred during move execution');
        }
    }
    
    // Animate move step by step, updating game state incrementally
    animateMoveStepByStep(startCupIndex) {
        try {
            // Save the initial state before building animation steps
            const initialBoard = [...this.gameState.board];
            const initialStores = [...this.gameState.stores];
            
            const animationSteps = [];
            let currentCupIndex = startCupIndex;
            
            // Build animation steps by simulating the move
            while (true) {
                const countersToDistribute = this.gameState.board[currentCupIndex];
                
                if (countersToDistribute === 0) {
                    break;
                }
                
                // Record the cup we're lifting from
                const liftingFromCup = currentCupIndex;
                let lastCupIndex = currentCupIndex;
                
                // Distribute counters one by one
                for (let i = 0; i < countersToDistribute; i++) {
                    const nextCupIndex = (currentCupIndex + i + 1) % 14;
                    
                    // Add animation step with state update function
                    animationSteps.push({
                        type: 'distribution',
                        fromCup: liftingFromCup,
                        toCup: nextCupIndex,
                        updateFn: () => {
                            // On first counter, empty the source cup
                            if (i === 0) {
                                this.gameState.board[liftingFromCup] = 0;
                            }
                            // Add counter to destination
                            this.gameState.board[nextCupIndex]++;
                        }
                    });
                    
                    lastCupIndex = nextCupIndex;
                }
                
                // Update state for the distribution we just planned
                this.gameState.board[liftingFromCup] = 0;
                for (let i = 0; i < countersToDistribute; i++) {
                    const nextCupIndex = (currentCupIndex + i + 1) % 14;
                    this.gameState.board[nextCupIndex]++;
                }
                
                // Check for continuation or capture
                const nextCupIndex = (lastCupIndex + 1) % 14;
                
                if (this.gameState.board[nextCupIndex] === 0) {
                    // Saada - check for capture
                    const cupBeyondEmpty = (nextCupIndex + 1) % 14;
                    
                    if (this.gameState.board[cupBeyondEmpty] > 0) {
                        // Capture!
                        const capturedCount = this.gameState.board[cupBeyondEmpty];
                        
                        console.log(`[CAPTURE] Player ${this.gameState.currentPlayer + 1} captured ${capturedCount} counters from cup ${cupBeyondEmpty}.`);
                        
                        // Add capture animation step
                        animationSteps.push({
                            type: 'capture',
                            fromCup: cupBeyondEmpty,
                            toStore: this.gameState.currentPlayer,
                            count: capturedCount,
                            updateFn: () => {
                                this.gameState.board[cupBeyondEmpty] = 0;
                                this.gameState.stores[this.gameState.currentPlayer] += capturedCount;
                            }
                        });
                        
                        // Update state for capture
                        this.gameState.board[cupBeyondEmpty] = 0;
                        this.gameState.stores[this.gameState.currentPlayer] += capturedCount;
                    }
                    
                    // End the move
                    break;
                }
                
                // Continue with the next cup
                currentCupIndex = nextCupIndex;
            }
            
            console.log(`[ANIMATION] Prepared ${animationSteps.length} animation steps.`);
            
            // Restore initial state before playing animations
            this.gameState.board = [...initialBoard];
            this.gameState.stores = [...initialStores];
            this.boardRenderer.updateCounters(this.gameState);
            
            // Play animation steps with incremental updates
            this.playAnimationStepsWithUpdates(animationSteps, 0, () => {
                // Animation complete - update UI and continue game
                this.onMoveAnimationComplete();
            });
        } catch (error) {
            console.error('[ERROR] Exception in animateMoveStepByStep:', error);
            this.showErrorMessage('Animation error occurred');
            this.boardRenderer.updateCounters(this.gameState);
            this.onMoveAnimationComplete();
        }
    }
    
    // Animate a complete move with all distributions and captures
    animateMove(initialState, startCupIndex) {
        try {
            const animationSteps = [];
            
            // Simulate the move step by step to collect animation data
            const simulatedState = initialState.clone();
            let currentCupIndex = startCupIndex;
            
            // Continue until we hit a Saada (empty cup)
            while (true) {
                const countersToDistribute = simulatedState.board[currentCupIndex];
                
                if (countersToDistribute === 0) {
                    break;
                }
                
                // Record distribution animations
                simulatedState.board[currentCupIndex] = 0;
                let lastCupIndex = currentCupIndex;
                
                for (let i = 0; i < countersToDistribute; i++) {
                    const nextCupIndex = (currentCupIndex + i + 1) % 14;
                    simulatedState.board[nextCupIndex]++;
                    lastCupIndex = nextCupIndex;
                    
                    // Add distribution animation step
                    animationSteps.push({
                        type: 'distribution',
                        fromCup: currentCupIndex,
                        toCup: nextCupIndex
                    });
                }
                
                // Check for continuation or capture
                const nextCupIndex = (lastCupIndex + 1) % 14;
                
                if (simulatedState.board[nextCupIndex] === 0) {
                    // Saada - check for capture
                    const cupBeyondEmpty = (nextCupIndex + 1) % 14;
                    
                    if (simulatedState.board[cupBeyondEmpty] > 0) {
                        // Capture!
                        const capturedCount = simulatedState.board[cupBeyondEmpty];
                        simulatedState.board[cupBeyondEmpty] = 0;
                        simulatedState.stores[simulatedState.currentPlayer] += capturedCount;
                        
                        console.log(`[CAPTURE] Player ${simulatedState.currentPlayer + 1} captured ${capturedCount} counters from cup ${cupBeyondEmpty}.`);
                        
                        // Add capture animation step
                        animationSteps.push({
                            type: 'capture',
                            fromCup: cupBeyondEmpty,
                            toStore: simulatedState.currentPlayer,
                            count: capturedCount
                        });
                    }
                    
                    // End the move
                    break;
                }
                
                // Continue with the next cup
                currentCupIndex = nextCupIndex;
            }
            
            console.log(`[ANIMATION] Playing ${animationSteps.length} animation steps.`);
            
            // Play all animation steps sequentially
            this.playAnimationSteps(animationSteps, 0, () => {
                // Animation complete - update UI and continue game
                this.onMoveAnimationComplete();
            });
        } catch (error) {
            console.error('[ERROR] Exception in animateMove:', error);
            this.showErrorMessage('Animation error occurred');
            // Try to recover by updating UI
            this.boardRenderer.updateCounters(this.gameState);
            this.onMoveAnimationComplete();
        }
    }
    
    // Play animation steps sequentially
    playAnimationSteps(steps, index, onComplete) {
        try {
            // Check if step mode is enabled
            if (this.stepMode && index === 0) {
                // Store steps and callback for step-by-step execution
                this.pendingAnimationSteps = steps;
                this.currentStepIndex = 0;
                this.stepCallback = onComplete;
                
                // Update UI
                const stepInfo = document.getElementById('step-info');
                const nextStepBtn = document.getElementById('next-step-btn');
                
                if (stepInfo) {
                    stepInfo.textContent = `Ready: ${steps.length} steps`;
                }
                if (nextStepBtn) {
                    nextStepBtn.disabled = false;
                }
                
                console.log(`[STEP MODE] ${steps.length} steps queued. Click "Next Step" to proceed.`);
                return;
            }
            
            if (index >= steps.length) {
                // All animations complete - final UI update
                this.boardRenderer.updateCounters(this.gameState);
                if (onComplete) onComplete();
                return;
            }
            
            const step = steps[index];
            
            if (step.type === 'distribution') {
                // Animate distribution
                this.animationController.animateDistribution(step.fromCup, step.toCup, () => {
                    // Update the UI counter for the destination cup after animation
                    this.boardRenderer.updateCounters(this.gameState);
                    
                    // Continue to next animation step
                    this.playAnimationSteps(steps, index + 1, onComplete);
                });
            } else if (step.type === 'capture') {
                // Animate capture
                this.animationController.animateCapture(step.fromCup, step.toStore, step.count, () => {
                    // Update the UI counters after capture animation
                    this.boardRenderer.updateCounters(this.gameState);
                    
                    // Continue to next animation step
                    this.playAnimationSteps(steps, index + 1, onComplete);
                });
            }
        } catch (error) {
            console.error('[ERROR] Exception in playAnimationSteps:', error);
            // Ensure UI is updated even on error
            this.boardRenderer.updateCounters(this.gameState);
            if (onComplete) onComplete();
        }
    }
    
    // Play animation steps with incremental state updates
    playAnimationStepsWithUpdates(steps, index, onComplete) {
        try {
            // Check if step mode is enabled
            if (this.stepMode && index === 0) {
                // Store steps and callback for step-by-step execution
                this.pendingAnimationSteps = steps;
                this.currentStepIndex = 0;
                this.stepCallback = onComplete;
                
                // Update UI
                const stepInfo = document.getElementById('step-info');
                const nextStepBtn = document.getElementById('next-step-btn');
                
                if (stepInfo) {
                    stepInfo.textContent = `Ready: ${steps.length} steps`;
                }
                if (nextStepBtn) {
                    nextStepBtn.disabled = false;
                }
                
                console.log(`[STEP MODE] ${steps.length} steps queued. Click "Next Step" to proceed.`);
                return;
            }
            
            if (index >= steps.length) {
                // All animations complete - final UI update
                this.boardRenderer.updateCounters(this.gameState);
                if (onComplete) onComplete();
                return;
            }
            
            const step = steps[index];
            
            // Call the update function BEFORE animating
            if (step.updateFn) {
                step.updateFn();
            }
            
            if (step.type === 'distribution') {
                // Update UI to show the new counter value
                this.boardRenderer.updateCounters(this.gameState);
                
                // Animate distribution
                this.animationController.animateDistribution(step.fromCup, step.toCup, () => {
                    // Continue to next animation step
                    this.playAnimationStepsWithUpdates(steps, index + 1, onComplete);
                });
            } else if (step.type === 'capture') {
                // Update UI to show the capture
                this.boardRenderer.updateCounters(this.gameState);
                
                // Animate capture
                this.animationController.animateCapture(step.fromCup, step.toStore, step.count, () => {
                    // Continue to next animation step
                    this.playAnimationStepsWithUpdates(steps, index + 1, onComplete);
                });
            }
        } catch (error) {
            console.error('[ERROR] Exception in playAnimationStepsWithUpdates:', error);
            // Ensure UI is updated even on error
            this.boardRenderer.updateCounters(this.gameState);
            if (onComplete) onComplete();
        }
    }
    
    // Called when move animation is complete
    onMoveAnimationComplete() {
        try {
            // Check if the game has ended
            if (this.gameState.gameOver) {
                console.log(`[GAME] Game ended. Winner: ${this.gameState.winner === 'tie' ? 'Tie' : 'Player ' + (this.gameState.winner + 1)}`);
                this.handleGameEnd();
                return;
            }
            
            // Show turn end feedback before switching players
            const currentPlayerName = this.gameState.playerTypes[this.gameState.currentPlayer] === 'ai' 
                ? 'AI' 
                : `Player ${this.gameState.currentPlayer + 1}`;
            this.showTurnEndFeedback(`${currentPlayerName}'s turn ended`, () => {
                // Switch to the next player
                this.gameState.currentPlayer = 1 - this.gameState.currentPlayer;
                
                console.log(`[TURN] Turn switched to Player ${this.gameState.currentPlayer + 1}.`);
                
                // Update UI for the next turn with animation
                this.boardRenderer.highlightSelectableCups(this.gameState);
                this.updateTurnIndicator();
                
                // If the next player is AI, trigger AI turn
                if (this.gameState.playerTypes[this.gameState.currentPlayer] === 'ai') {
                    this.executeAITurn();
                }
            });
        } catch (error) {
            console.error('[ERROR] Exception in onMoveAnimationComplete:', error);
            this.showErrorMessage('Error completing move');
        }
    }

    // Handle game end
    handleGameEnd() {
        this.boardRenderer.clearHighlights();
        this.boardRenderer.showWinner(this.gameState.winner);
    }

    // Execute AI turn with a small delay for better UX
    executeAITurn() {
        try {
            // Show AI thinking indicator
            this.showAIThinkingIndicator();
            
            // Disable user input by clearing highlights
            this.boardRenderer.clearHighlights();
            
            console.log(`[AI] AI (Player ${this.gameState.currentPlayer + 1}) is thinking...`);
            
            // Add a 500ms delay for better user experience
            setTimeout(() => {
                try {
                    // Check if game is still active
                    if (this.gameState.gameOver) {
                        console.log('[AI] Game ended before AI could move.');
                        this.hideAIThinkingIndicator();
                        return;
                    }
                    
                    // Check if it's still AI's turn (in case something changed)
                    if (this.gameState.playerTypes[this.gameState.currentPlayer] !== 'ai') {
                        console.log('[AI] No longer AI\'s turn.');
                        this.hideAIThinkingIndicator();
                        return;
                    }
                    
                    // Let AI select a move
                    const selectedMove = this.aiPlayer.selectMove(this.gameState);
                    
                    // If no valid move found, skip turn
                    if (selectedMove === null) {
                        console.error('[AI] AI has no valid moves available.');
                        this.hideAIThinkingIndicator();
                        this.showErrorMessage('AI has no valid moves');
                        return;
                    }
                    
                    console.log(`[AI] AI selected cup ${selectedMove} with ${this.gameState.board[selectedMove]} counters.`);
                    
                    // Hide AI thinking indicator before starting animations
                    this.hideAIThinkingIndicator();
                    
                    // Execute the AI's move with animations
                    this.executeMoveWithAnimation(selectedMove);
                } catch (error) {
                    console.error('[ERROR] Exception during AI turn execution:', error);
                    this.hideAIThinkingIndicator();
                    this.showErrorMessage('AI encountered an error');
                }
            }, 500);
        } catch (error) {
            console.error('[ERROR] Exception in executeAITurn:', error);
            this.hideAIThinkingIndicator();
            this.showErrorMessage('AI turn failed');
        }
    }
    
    // Show AI thinking indicator
    showAIThinkingIndicator() {
        const indicator = document.getElementById('ai-thinking-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
    }
    
    // Hide AI thinking indicator
    hideAIThinkingIndicator() {
        const indicator = document.getElementById('ai-thinking-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    // Show turn end feedback message
    showTurnEndFeedback(message, callback) {
        try {
            const feedbackElement = document.getElementById('turn-end-feedback');
            const messageElement = document.querySelector('.turn-end-message');
            
            if (feedbackElement && messageElement) {
                // Set the message
                messageElement.textContent = message;
                
                // Show the feedback
                feedbackElement.style.display = 'block';
                
                // Hide after 800ms and call callback
                setTimeout(() => {
                    feedbackElement.style.display = 'none';
                    if (callback) callback();
                }, 800);
            } else {
                // If elements not found, just call callback immediately
                if (callback) callback();
            }
        } catch (error) {
            console.error('[ERROR] Exception in showTurnEndFeedback:', error);
            // Call callback even on error to prevent game from getting stuck
            if (callback) callback();
        }
    }

    // Update turn indicator in the UI
    updateTurnIndicator() {
        try {
            const player0Info = document.getElementById('player-0-info');
            const player1Info = document.getElementById('player-1-info');
            
            if (player0Info && player1Info) {
                // Remove active class from both
                player0Info.classList.remove('active-player');
                player1Info.classList.remove('active-player');
                
                // Add active class to current player
                if (this.gameState.currentPlayer === 0) {
                    player0Info.classList.add('active-player');
                } else {
                    player1Info.classList.add('active-player');
                }
            }
        } catch (error) {
            console.error('[ERROR] Exception in updateTurnIndicator:', error);
        }
    }
    
    // Show error message to the user
    showErrorMessage(message) {
        try {
            // Create or get error message element
            let errorElement = document.getElementById('error-message');
            
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.id = 'error-message';
                errorElement.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #ff4444;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 2000;
                    font-size: 14px;
                    font-weight: 500;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                document.body.appendChild(errorElement);
            }
            
            // Set message and show
            errorElement.textContent = message;
            errorElement.style.opacity = '1';
            
            // Hide after 3 seconds
            setTimeout(() => {
                errorElement.style.opacity = '0';
            }, 3000);
        } catch (error) {
            console.error('[ERROR] Exception in showErrorMessage:', error);
        }
    }

    // Reset game to initial state
    resetGame() {
        // Show mode selection screen
        if (this.modeSelectionElement) {
            this.modeSelectionElement.style.display = 'flex';
        }
        if (this.gameBoardElement) {
            this.gameBoardElement.style.display = 'none';
        }
        
        // Hide animation settings
        const animationSettings = document.getElementById('animation-settings');
        if (animationSettings) {
            animationSettings.style.display = 'none';
        }
        
        // Hide winner overlay
        const winnerOverlay = document.getElementById('winner-overlay');
        if (winnerOverlay) {
            winnerOverlay.style.display = 'none';
        }
        
        // Reset game state
        this.gameState = new GameState();
    }

    // Get current game state (read-only)
    getGameState() {
        return this.gameState;
    }
    
    // Setup step-by-step mode controls
    setupStepModeControls() {
        const stepModeCheckbox = document.getElementById('step-mode');
        const stepControl = document.getElementById('step-control');
        const nextStepBtn = document.getElementById('next-step-btn');
        
        if (stepModeCheckbox) {
            stepModeCheckbox.addEventListener('change', (e) => {
                this.stepMode = e.target.checked;
                if (stepControl) {
                    stepControl.style.display = this.stepMode ? 'block' : 'none';
                }
                console.log(`[STEP MODE] ${this.stepMode ? 'Enabled' : 'Disabled'}`);
            });
        }
        
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                this.executeNextStep();
            });
        }
    }
    
    // Execute the next animation step in step mode
    executeNextStep() {
        if (!this.stepMode || this.pendingAnimationSteps.length === 0) {
            return;
        }
        
        const nextStepBtn = document.getElementById('next-step-btn');
        const stepInfo = document.getElementById('step-info');
        
        if (this.currentStepIndex < this.pendingAnimationSteps.length) {
            // Disable button during animation
            if (nextStepBtn) nextStepBtn.disabled = true;
            
            const step = this.pendingAnimationSteps[this.currentStepIndex];
            this.currentStepIndex++;
            
            // Update step info
            if (stepInfo) {
                stepInfo.textContent = `Step ${this.currentStepIndex} of ${this.pendingAnimationSteps.length}`;
            }
            
            // Call the update function BEFORE animating
            if (step.updateFn) {
                step.updateFn();
            }
            
            // Execute the animation step
            if (step.type === 'distribution') {
                // Update UI to show the new counter value
                this.boardRenderer.updateCounters(this.gameState);
                
                this.animationController.animateDistribution(step.fromCup, step.toCup, () => {
                    // Re-enable button for next step
                    if (nextStepBtn) nextStepBtn.disabled = false;
                    
                    // Check if all steps are complete
                    if (this.currentStepIndex >= this.pendingAnimationSteps.length) {
                        this.completeStepMode();
                    }
                });
            } else if (step.type === 'capture') {
                // Update UI to show the capture
                this.boardRenderer.updateCounters(this.gameState);
                
                this.animationController.animateCapture(step.fromCup, step.toStore, step.count, () => {
                    // Re-enable button for next step
                    if (nextStepBtn) nextStepBtn.disabled = false;
                    
                    // Check if all steps are complete
                    if (this.currentStepIndex >= this.pendingAnimationSteps.length) {
                        this.completeStepMode();
                    }
                });
            }
        }
    }
    
    // Complete step mode and continue game
    completeStepMode() {
        const stepInfo = document.getElementById('step-info');
        if (stepInfo) {
            stepInfo.textContent = 'Move complete!';
        }
        
        // Clear pending steps
        this.pendingAnimationSteps = [];
        this.currentStepIndex = 0;
        
        // Call the stored callback
        if (this.stepCallback) {
            const callback = this.stepCallback;
            this.stepCallback = null;
            callback();
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const gameController = new GameController();
    
    // Make game controller accessible globally for testing
    window.gameController = gameController;
    
    // Initialize renderer
    gameController.boardRenderer = new BoardRenderer(document.getElementById('game-board'));
    
    // Initialize animation controller
    gameController.animationController = new AnimationController(gameController.boardRenderer);
    
    // Cache DOM elements
    gameController.modeSelectionElement = document.getElementById('mode-selection');
    gameController.gameBoardElement = document.getElementById('game-board');
    
    // Mode selection buttons
    const singlePlayerBtn = document.getElementById('single-player-btn');
    const twoPlayerBtn = document.getElementById('two-player-btn');
    
    singlePlayerBtn.addEventListener('click', () => {
        gameController.startGame('single');
    });
    
    twoPlayerBtn.addEventListener('click', () => {
        gameController.startGame('two-player');
    });
    
    // Cup click handler - delegate to event delegation on the board
    const gameBoard = document.getElementById('game-board');
    gameBoard.addEventListener('click', (event) => {
        // Check if a cup was clicked
        if (event.target.classList.contains('cup')) {
            const cupIndex = parseInt(event.target.dataset.index);
            gameController.handleCupClick(cupIndex);
        }
    });
    
    // New game button handler
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            gameController.resetGame();
        });
    }
    
    // Animation speed selector handler
    const animationSpeedSelect = document.getElementById('animation-speed');
    if (animationSpeedSelect) {
        animationSpeedSelect.addEventListener('change', (event) => {
            const speed = parseInt(event.target.value);
            if (gameController.animationController) {
                gameController.animationController.setSpeed(speed);
            }
        });
    }
});
