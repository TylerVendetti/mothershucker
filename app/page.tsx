"use client"

import { useEffect, useRef } from "react"

export default function MothershuckerGameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<any>(null)

  useEffect(() => {
    if (canvasRef.current) {
      gameRef.current = new MothershuckerGame(canvasRef.current)
      gameRef.current.start()
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.cleanup()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-green-400 flex items-center justify-center">
      <canvas ref={canvasRef} width={800} height={600} className="border-2 border-gray-300 rounded-lg" />
    </div>
  )
}

class MothershuckerGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationId = 0
  private titleImage: HTMLImageElement | null = null

  // Game state
  private score = 0
  private throwsRemaining = 7
  private gameState: "menu" | "difficulty" | "instructions" | "aiming" | "throwing" | "gameOver" = "menu"
  private difficulty: "easy" | "medium" | "hard" | "extreme" = "easy"

  // Mouse-controlled aiming
  private mouseX = 0
  private mouseY = 0
  private currentAngle = 0.8
  private currentPower = 0.8

  // Mid-air control
  private isControllingFlight = false

  // Throwing
  private currentBag: BeanBag | null = null
  private bags: BeanBag[] = []

  // Wind system (for Extreme mode)
  private wind = {
    x: 0, // Horizontal wind force (-1 to 1, negative = left, positive = right)
    y: 0, // Vertical wind force (-0.5 to 0.5, negative = up, positive = down)
    strength: 0, // Overall wind strength (0 to 1)
    direction: 0, // Wind direction in radians
    changeTimer: 0, // Timer for wind changes
  }

  // Board dimensions
  private board = {
    x: 500,
    y: 480, // Moved down from 400 to 480 for better accessibility
    width: 200,
    height: 100,
    holeX: 650, // Center-right position
    holeY: 385, // Will be recalculated to sit on board surface
    holeRadius: 18,
  }

  // Original board position for resetting
  private originalBoard = {
    x: 500,
    y: 480,
    holeX: 650,
  }

  // Throw origin
  private throwOrigin = {
    x: 100,
    y: 500,
  }

  // Add these properties after the existing properties in the constructor
  private hoveredButton: "play" | "rules" | "none" = "none"
  private buttonAnimationTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
    this.setupEventListeners()
    this.initializeWind()
    this.loadTitleImage()
  }

  private loadTitleImage() {
    this.titleImage = new Image()
    this.titleImage.crossOrigin = "anonymous"
    this.titleImage.src = "/images/mothershucker-title-new.png"
  }

  private initializeWind() {
    this.generateNewWind()
  }

  private generateNewWind() {
    // Generate random wind
    this.wind.strength = Math.random() * 0.8 + 0.2 // 0.2 to 1.0
    this.wind.direction = Math.random() * Math.PI * 2 // 0 to 2π
    this.wind.x = Math.cos(this.wind.direction) * this.wind.strength * 0.3
    this.wind.y = Math.sin(this.wind.direction) * this.wind.strength * 0.15
    this.wind.changeTimer = 300 + Math.random() * 300 // 5-10 seconds at 60fps
  }

  private updateWind() {
    // Wind now changes after each throw instead of on a timer
    // This method is kept for potential future use
  }

  private setupEventListeners() {
    this.canvas.addEventListener("click", this.handleClick.bind(this))
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this))
  }

  private handleMouseMove(event: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = event.clientX - rect.left
    this.mouseY = event.clientY - rect.top

    // Update aiming angle based on mouse position
    if (this.gameState === "aiming") {
      this.updateAimingFromMouse()
    }

    // Control bag in flight
    if (this.gameState === "throwing" && this.currentBag && this.isControllingFlight) {
      this.currentBag.adjustTrajectory(this.mouseX, this.mouseY)
    }

    // Check for button hover in menu state
    if (this.gameState === "menu") {
      this.checkMenuButtonHover()
    }
  }

  private checkMenuButtonHover() {
    // Play button bounds - bottom left, stacked vertically
    const playButtonX = 60
    const playButtonY = this.canvas.height - 160
    const playButtonWidth = 100
    const playButtonHeight = 40

    // Rules button bounds - below Play button
    const rulesButtonX = 60
    const rulesButtonY = this.canvas.height - 110
    const rulesButtonWidth = 100
    const rulesButtonHeight = 40

    // Check if mouse is over Play button
    if (
      this.mouseX >= playButtonX &&
      this.mouseX <= playButtonX + playButtonWidth &&
      this.mouseY >= playButtonY &&
      this.mouseY <= playButtonY + playButtonHeight
    ) {
      this.hoveredButton = "play"
    }
    // Check if mouse is over Rules button
    else if (
      this.mouseX >= rulesButtonX &&
      this.mouseX <= rulesButtonX + rulesButtonWidth &&
      this.mouseY >= rulesButtonY &&
      this.mouseY <= rulesButtonY + rulesButtonHeight
    ) {
      this.hoveredButton = "rules"
    } else {
      this.hoveredButton = "none"
    }
  }

  private updateAimingFromMouse() {
    // Calculate angle from throw origin to mouse position
    const dx = this.mouseX - this.throwOrigin.x
    const dy = this.throwOrigin.y - this.mouseY // Inverted Y for upward angles

    if (dx > 0) {
      // Only aim forward
      this.currentAngle = Math.atan2(dy, dx)

      // Clamp angle to reasonable throwing range
      const minAngle = 0.1 // Nearly horizontal
      const maxAngle = 1.4 // High arc
      this.currentAngle = Math.max(minAngle, Math.min(maxAngle, this.currentAngle))

      // Calculate power based on distance from origin (further = more power)
      const distance = Math.sqrt(dx * dx + dy * dy)
      this.currentPower = Math.min(1.2, Math.max(0.4, distance / 300))
    }
  }

  private handleClick() {
    if (this.gameState === "menu") {
      this.handleMenuClick()
    } else if (this.gameState === "difficulty") {
      this.handleDifficultyClick()
    } else if (this.gameState === "instructions") {
      this.handleInstructionsClick()
    } else if (this.gameState === "aiming" && this.throwsRemaining > 0) {
      this.throwBag()
    } else if (this.gameState === "gameOver") {
      this.restart()
    }
  }

  private handleMenuClick() {
    // Play button - bottom left, stacked vertically
    const playButtonX = 60
    const playButtonY = this.canvas.height - 160
    const playButtonWidth = 100
    const playButtonHeight = 40

    // Rules button - below Play button
    const rulesButtonX = 60
    const rulesButtonY = this.canvas.height - 110
    const rulesButtonWidth = 100
    const rulesButtonHeight = 40

    // Check if click is within Play button
    if (
      this.mouseX >= playButtonX &&
      this.mouseX <= playButtonX + playButtonWidth &&
      this.mouseY >= playButtonY &&
      this.mouseY <= playButtonY + playButtonHeight
    ) {
      this.gameState = "difficulty"
    }

    // Check if click is within Rules button
    if (
      this.mouseX >= rulesButtonX &&
      this.mouseX <= rulesButtonX + rulesButtonWidth &&
      this.mouseY >= rulesButtonY &&
      this.mouseY <= rulesButtonY + rulesButtonHeight
    ) {
      this.gameState = "instructions"
    }
  }

  private handleDifficultyClick() {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Easy button
    const easyButtonX = centerX - 220
    const easyButtonY = centerY + 20
    const easyButtonWidth = 90
    const easyButtonHeight = 40

    // Medium button
    const mediumButtonX = centerX - 120
    const mediumButtonY = centerY + 20
    const mediumButtonWidth = 90
    const mediumButtonHeight = 40

    // Hard button
    const hardButtonX = centerX - 20
    const hardButtonY = centerY + 20
    const hardButtonWidth = 90
    const hardButtonHeight = 40

    // Extreme button
    const extremeButtonX = centerX + 80
    const extremeButtonY = centerY + 20
    const extremeButtonWidth = 90
    const extremeButtonHeight = 40

    // Back button
    const backButtonX = centerX - 50
    const backButtonY = centerY + 100
    const backButtonWidth = 100
    const backButtonHeight = 40

    // Check difficulty button clicks
    if (
      this.mouseX >= easyButtonX &&
      this.mouseX <= easyButtonX + easyButtonWidth &&
      this.mouseY >= easyButtonY &&
      this.mouseY <= easyButtonY + easyButtonHeight
    ) {
      this.difficulty = "easy"
      this.startGame()
    }

    if (
      this.mouseX >= mediumButtonX &&
      this.mouseX <= mediumButtonX + mediumButtonWidth &&
      this.mouseY >= mediumButtonY &&
      this.mouseY <= mediumButtonY + mediumButtonHeight
    ) {
      this.difficulty = "medium"
      this.startGame()
    }

    if (
      this.mouseX >= hardButtonX &&
      this.mouseX <= hardButtonX + hardButtonWidth &&
      this.mouseY >= hardButtonY &&
      this.mouseY <= hardButtonY + hardButtonHeight
    ) {
      this.difficulty = "hard"
      this.startGame()
    }

    if (
      this.mouseX >= extremeButtonX &&
      this.mouseX <= extremeButtonX + extremeButtonWidth &&
      this.mouseY >= extremeButtonY &&
      this.mouseY <= extremeButtonY + extremeButtonHeight
    ) {
      this.difficulty = "extreme"
      this.startGame()
    }

    // Check if click is within Back button
    if (
      this.mouseX >= backButtonX &&
      this.mouseX <= backButtonX + backButtonWidth &&
      this.mouseY >= backButtonY &&
      this.mouseY <= backButtonY + backButtonHeight
    ) {
      this.gameState = "menu"
    }
  }

  private handleInstructionsClick() {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Back button
    const backButtonX = centerX - 50
    const backButtonY = centerY + 220
    const backButtonWidth = 100
    const backButtonHeight = 40

    // Check if click is within Back button
    if (
      this.mouseX >= backButtonX &&
      this.mouseX <= backButtonX + backButtonWidth &&
      this.mouseY >= backButtonY &&
      this.mouseY <= backButtonY + backButtonHeight
    ) {
      this.gameState = "menu"
    }
  }

  private startGame() {
    this.gameState = "aiming"
    this.score = 0
    this.throwsRemaining = 7
    this.currentBag = null
    this.bags = []
    this.isControllingFlight = false
    this.currentAngle = 0.8
    this.currentPower = 0.8

    // Reset board to original position
    this.board.x = this.originalBoard.x
    this.board.y = this.originalBoard.y
    this.board.holeX = this.originalBoard.holeX

    // Initialize wind for extreme mode
    if (this.difficulty === "extreme") {
      this.generateNewWind()
    }
  }

  private throwBag() {
    const angle = this.currentAngle
    const power = this.currentPower

    this.currentBag = new BeanBag(
      this.throwOrigin.x,
      this.throwOrigin.y,
      Math.cos(angle) * power * 15,
      -Math.sin(angle) * power * 15,
    )

    // Apply wind to the bag if in extreme mode
    if (this.difficulty === "extreme") {
      this.currentBag.setWind(this.wind.x, this.wind.y)
      // Generate new wind for the next throw
      this.generateNewWind()
    }

    this.gameState = "throwing"
    this.isControllingFlight = true
    this.throwsRemaining--
  }

  private moveBoard() {
    if (this.difficulty === "hard" || this.difficulty === "extreme") {
      // Store old board position
      const oldBoardX = this.board.x
      const oldBoardY = this.board.y
      const oldHoleX = this.board.holeX

      // Move board to a new random position
      const minX = 400
      const maxX = 600
      const minY = 420
      const maxY = 520

      this.board.x = minX + Math.random() * (maxX - minX)
      this.board.y = minY + Math.random() * (maxY - minY)

      // Keep hole in center-right of board
      this.board.holeX = this.board.x + this.board.width * 0.75

      // Calculate the movement delta
      const deltaX = this.board.x - oldBoardX
      const deltaY = this.board.y - oldBoardY

      // Move all bags that are on the board
      this.bags.forEach((bag) => {
        // Check if bag was on the old board position
        const wasOnBoard = this.wasBagOnBoard(bag, oldBoardX, oldBoardY)

        if (wasOnBoard) {
          // Move the bag with the board
          bag.x += deltaX
          bag.y += deltaY

          // Recalculate the bag's position on the new angled surface
          const boardProgress = (bag.x - this.board.x) / this.board.width
          const boardLeftY = this.board.y + 20
          const boardRightY = this.board.y - 40
          const newSurfaceY = boardLeftY + (boardRightY - boardLeftY) * boardProgress
          bag.y = newSurfaceY
        }
      })
    }
  }

  private wasBagOnBoard(bag: BeanBag, boardX: number, boardY: number): boolean {
    // Check if the bag was within the board boundaries
    const boardLeftY = boardY + 20
    const boardRightY = boardY - 40

    // Calculate the angled surface Y position at bag's X location
    const boardProgress = (bag.x - boardX) / this.board.width
    const surfaceY = boardLeftY + (boardRightY - boardLeftY) * boardProgress

    // Check if bag is on the board surface (with some tolerance)
    return (
      bag.x >= boardX && bag.x <= boardX + this.board.width && Math.abs(bag.y - surfaceY) < 25 // Tolerance for bags sitting on board
    )
  }

  private updateBag() {
    if (!this.currentBag) return

    this.currentBag.update()

    // Check for hole collision FIRST (highest priority)
    if (this.checkHoleCollision()) {
      return // Exit early if hole collision occurred
    }

    // Then check for board collision
    if (this.checkBoardCollision()) {
      return // Exit early if board collision occurred
    }

    // Check if bag has landed on ground (only if it hasn't hit board or hole)
    if (this.currentBag && this.currentBag.y >= this.canvas.height - 50) {
      this.evaluateLanding()
      this.bags.push(this.currentBag)
      this.currentBag = null
      this.isControllingFlight = false

      // Move board after throw in hard/extreme mode
      this.moveBoard()

      if (this.throwsRemaining <= 0) {
        this.gameState = "gameOver"
      } else {
        this.gameState = "aiming"
      }
    }
  }

  private checkHoleCollision(): boolean {
    if (!this.currentBag) return false

    const bagX = this.currentBag.x
    const bagY = this.currentBag.y

    // Calculate actual hole position on board surface
    const boardProgress = (this.board.holeX - this.board.x) / this.board.width
    const boardLeftY = this.board.y + 20
    const boardRightY = this.board.y - 40
    const actualHoleY = boardLeftY + (boardRightY - boardLeftY) * boardProgress - 10

    // Check if bag is in the hole area
    const distToHole = Math.sqrt(Math.pow(bagX - this.board.holeX, 2) + Math.pow(bagY - actualHoleY, 2))

    if (
      distToHole <= this.board.holeRadius &&
      bagY >= actualHoleY - 20 &&
      bagY <= actualHoleY + 20 &&
      this.currentBag.vy > -2
    ) {
      // Bag went in the hole!
      this.score += 3
      this.currentBag.setScoreType("hole")
      this.currentBag.y = actualHoleY
      this.currentBag.vx = 0
      this.currentBag.vy = 0

      // End this throw
      this.bags.push(this.currentBag)
      this.currentBag = null
      this.isControllingFlight = false

      // Move board after throw in hard/extreme mode
      this.moveBoard()

      if (this.throwsRemaining <= 0) {
        this.gameState = "gameOver"
      } else {
        this.gameState = "aiming"
      }

      return true
    }

    return false
  }

  private checkBoardCollision(): boolean {
    if (!this.currentBag) return false

    const bagX = this.currentBag.x
    const bagY = this.currentBag.y

    // Adjust collision detection for angled board (left lower, right higher)
    const boardLeftY = this.board.y + 20
    const boardRightY = this.board.y - 40

    // Calculate the angled surface Y position at bagX
    const boardProgress = (bagX - this.board.x) / this.board.width
    const surfaceY = boardLeftY + (boardRightY - boardLeftY) * boardProgress

    // Check if bag is landing on the angled board surface
    if (
      bagX >= this.board.x &&
      bagX <= this.board.x + this.board.width &&
      bagY >= surfaceY - 20 && // Increased tolerance above surface
      bagY <= surfaceY + 15 && // Increased tolerance below surface
      this.currentBag.vy > -1 // Less strict velocity requirement
    ) {
      // Check if it's NOT in the hole area
      const holeProgress = (this.board.holeX - this.board.x) / this.board.width
      const holeLeftY = this.board.y + 20
      const holeRightY = this.board.y - 40
      const actualHoleY = holeLeftY + (holeRightY - holeLeftY) * holeProgress - 10
      const distToHole = Math.sqrt(Math.pow(bagX - this.board.holeX, 2) + Math.pow(bagY - actualHoleY, 2))

      if (distToHole > this.board.holeRadius + 5) {
        // Reduced hole exclusion area
        // Check if there's already a bag very close to this position
        const tooClose = false
        for (const existingBag of this.bags) {
          const distToExisting = Math.sqrt(Math.pow(bagX - existingBag.x, 2) + Math.pow(bagY - existingBag.y, 2))
          if (distToExisting < 15) {
            // If too close to existing bag
            // Instead of blocking, slightly adjust position
            const angle = Math.atan2(bagY - existingBag.y, bagX - existingBag.x)
            this.currentBag.x = existingBag.x + Math.cos(angle) * 20
            this.currentBag.y = existingBag.y + Math.sin(angle) * 20

            // Recalculate surface Y for new position
            const newBoardProgress = (this.currentBag.x - this.board.x) / this.board.width
            const newSurfaceY = boardLeftY + (boardRightY - boardLeftY) * newBoardProgress
            this.currentBag.y = Math.min(this.currentBag.y, newSurfaceY)
            break
          }
        }

        // Bag landed on board!
        this.score += 1
        this.currentBag.setScoreType("board")

        // Recalculate final surface position
        const finalBoardProgress = (this.currentBag.x - this.board.x) / this.board.width
        const finalSurfaceY = boardLeftY + (boardRightY - boardLeftY) * finalBoardProgress
        this.currentBag.y = finalSurfaceY // Position on angled surface

        this.currentBag.vx *= 0.7
        this.currentBag.vy = 0

        // End this throw
        this.bags.push(this.currentBag)
        this.currentBag = null
        this.isControllingFlight = false

        // Move board after throw in hard/extreme mode
        this.moveBoard()

        if (this.throwsRemaining <= 0) {
          this.gameState = "gameOver"
        } else {
          this.gameState = "aiming"
        }

        return true
      }
    }

    return false
  }

  private evaluateLanding() {
    if (!this.currentBag) return

    // Only handle misses now - board and hole hits are handled during flight
    this.currentBag.setScoreType("miss")
  }

  private drawBoard() {
    const ctx = this.ctx

    // Board dimensions for side perspective - LEFT LOWER, RIGHT HIGHER
    const boardLeft = this.board.x
    const boardRight = this.board.x + this.board.width
    const boardLeftY = this.board.y + 20 // Lower end (left side closer to ground)
    const boardRightY = this.board.y - 40 // Higher end (right side in air)

    // Draw board shadow first
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
    ctx.beginPath()
    ctx.moveTo(boardLeft + 8, boardLeftY + 8)
    ctx.lineTo(boardRight + 8, boardRightY + 8)
    ctx.lineTo(boardRight + 8, boardRightY - 20 + 8)
    ctx.lineTo(boardLeft + 8, boardLeftY - 20 + 8)
    ctx.closePath()
    ctx.fill()

    // Create wood gradient for realistic wood color
    const woodGradient = ctx.createLinearGradient(boardLeft, boardLeftY - 10, boardRight, boardRightY - 10)
    woodGradient.addColorStop(0, "#D2691E") // Saddle brown
    woodGradient.addColorStop(0.2, "#CD853F") // Peru
    woodGradient.addColorStop(0.4, "#DEB887") // Burlywood
    woodGradient.addColorStop(0.6, "#F4A460") // Sandy brown
    woodGradient.addColorStop(0.8, "#D2691E") // Saddle brown
    woodGradient.addColorStop(1, "#A0522D") // Sienna

    // Draw the main board surface
    ctx.fillStyle = woodGradient
    ctx.beginPath()
    ctx.moveTo(boardLeft, boardLeftY)
    ctx.lineTo(boardRight, boardRightY)
    ctx.lineTo(boardRight, boardRightY - 20)
    ctx.lineTo(boardLeft, boardLeftY - 20)
    ctx.closePath()
    ctx.fill()

    // Add realistic wood grain texture
    ctx.strokeStyle = "rgba(139, 69, 19, 0.3)"
    ctx.lineWidth = 1
    for (let i = 0; i < 15; i++) {
      const progress = i / 15
      const leftY = boardLeftY - 20 + 20 * progress
      const rightY = boardRightY - 20 + 20 * progress

      // Vary the grain opacity and offset for realism
      const opacity = 0.2 + Math.sin(i * 0.5) * 0.1
      ctx.strokeStyle = `rgba(139, 69, 19, ${opacity})`

      // Add slight curves to grain lines
      const curve = Math.sin(i * 0.3) * 2
      ctx.beginPath()
      ctx.moveTo(boardLeft + 5, leftY + curve)
      ctx.quadraticCurveTo(
        boardLeft + this.board.width * 0.5,
        (leftY + rightY) * 0.5 + curve * 0.5,
        boardRight - 5,
        rightY + curve,
      )
      ctx.stroke()
    }

    // Add wood knots and imperfections
    const knots = [
      { x: boardLeft + 40, y: boardLeftY - 15, size: 3 },
      { x: boardLeft + 120, y: boardLeftY - 8, size: 2 },
      { x: boardLeft + 160, y: boardLeftY - 12, size: 4 },
    ]

    knots.forEach((knot) => {
      ctx.fillStyle = "rgba(101, 67, 33, 0.6)"
      ctx.beginPath()
      ctx.ellipse(knot.x, knot.y, knot.size, knot.size * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()

      // Inner knot detail
      ctx.fillStyle = "rgba(101, 67, 33, 0.8)"
      ctx.beginPath()
      ctx.ellipse(knot.x, knot.y, knot.size * 0.5, knot.size * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()
    })

    // Add wood edge highlighting for 3D effect
    ctx.strokeStyle = "rgba(255, 248, 220, 0.8)" // Cornsilk highlight
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boardLeft, boardLeftY - 20)
    ctx.lineTo(boardRight, boardRightY - 20)
    ctx.stroke()

    // Add darker edge for depth
    ctx.strokeStyle = "rgba(101, 67, 33, 0.8)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boardLeft, boardLeftY)
    ctx.lineTo(boardRight, boardRightY)
    ctx.stroke()

    // Draw wooden support legs with realistic wood texture
    const legWidth = 12
    const leftLegHeight = 45
    const rightLegHeight = 85

    // Left leg (shorter) - with wood grain
    const leftLegGradient = ctx.createLinearGradient(boardLeft + 15, boardLeftY, boardLeft + 15 + legWidth, boardLeftY)
    leftLegGradient.addColorStop(0, "#8B4513")
    leftLegGradient.addColorStop(0.5, "#A0522D")
    leftLegGradient.addColorStop(1, "#654321")

    ctx.fillStyle = leftLegGradient
    ctx.fillRect(boardLeft + 15, boardLeftY, legWidth, leftLegHeight)

    // Left leg base
    ctx.fillStyle = "#654321"
    ctx.fillRect(boardLeft + 10, boardLeftY + leftLegHeight - 8, legWidth + 10, 8)

    // Right leg (taller) - with wood grain
    const rightLegGradient = ctx.createLinearGradient(
      boardRight - 27,
      boardRightY,
      boardRight - 27 + legWidth,
      boardRightY,
    )
    rightLegGradient.addColorStop(0, "#8B4513")
    rightLegGradient.addColorStop(0.5, "#A0522D")
    rightLegGradient.addColorStop(1, "#654321")

    ctx.fillStyle = rightLegGradient
    ctx.fillRect(boardRight - 27, boardRightY, legWidth, rightLegHeight)

    // Right leg base
    ctx.fillStyle = "#654321"
    ctx.fillRect(boardRight - 32, boardRightY + rightLegHeight - 8, legWidth + 10, 8)

    // Add vertical grain to legs
    ctx.strokeStyle = "rgba(101, 67, 33, 0.4)"
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      // Left leg grain
      ctx.beginPath()
      ctx.moveTo(boardLeft + 17 + i * 3, boardLeftY + 5)
      ctx.lineTo(boardLeft + 17 + i * 3, boardLeftY + leftLegHeight - 10)
      ctx.stroke()

      // Right leg grain
      ctx.beginPath()
      ctx.moveTo(boardRight - 25 + i * 3, boardRightY + 5)
      ctx.lineTo(boardRight - 25 + i * 3, boardRightY + rightLegHeight - 10)
      ctx.stroke()
    }

    // Draw cross support beam with wood texture
    const beamGradient = ctx.createLinearGradient(boardLeft + 30, boardLeftY + 20, boardLeft + 30, boardLeftY + 26)
    beamGradient.addColorStop(0, "#A0522D")
    beamGradient.addColorStop(1, "#8B4513")

    ctx.fillStyle = beamGradient
    ctx.beginPath()
    ctx.moveTo(boardLeft + 30, boardLeftY + 20)
    ctx.lineTo(boardRight - 30, boardRightY + 20)
    ctx.lineTo(boardRight - 30, boardRightY + 26)
    ctx.lineTo(boardLeft + 30, boardLeftY + 26)
    ctx.closePath()
    ctx.fill()

    // Draw the hole with realistic wood edge
    const holeX = this.board.holeX
    const holeProgress = (holeX - this.board.x) / this.board.width
    const holeLeftY = this.board.y + 20
    const holeRightY = this.board.y - 40
    const holeY = holeLeftY + (holeRightY - holeLeftY) * holeProgress - 10

    const boardAngle = Math.atan2(holeRightY - holeLeftY, this.board.width)

    // Hole depth/shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
    ctx.beginPath()
    ctx.ellipse(holeX, holeY, this.board.holeRadius, this.board.holeRadius * 0.4, boardAngle, 0, Math.PI * 2)
    ctx.fill()

    // Hole rim with wood texture
    ctx.strokeStyle = "#D2691E"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(holeX, holeY, this.board.holeRadius, this.board.holeRadius * 0.4, boardAngle, 0, Math.PI * 2)
    ctx.stroke()

    // Inner hole rim highlight
    ctx.strokeStyle = "rgba(222, 184, 135, 0.8)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(holeX, holeY, this.board.holeRadius - 1, (this.board.holeRadius - 1) * 0.4, boardAngle, 0, Math.PI * 2)
    ctx.stroke()

    // Add subtle board edge border for finished look
    ctx.strokeStyle = "#8B4513"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(boardLeft, boardLeftY)
    ctx.lineTo(boardRight, boardRightY)
    ctx.lineTo(boardRight, boardRightY - 20)
    ctx.lineTo(boardLeft, boardLeftY - 20)
    ctx.closePath()
    ctx.stroke()
  }

  private drawBackground() {
    const ctx = this.ctx

    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.6)
    skyGradient.addColorStop(0, "#87CEEB") // Sky blue
    skyGradient.addColorStop(1, "#B0E0E6") // Powder blue
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.6)

    // Draw distant hills
    ctx.fillStyle = "#90EE90"
    ctx.beginPath()
    ctx.moveTo(0, this.canvas.height * 0.5)
    ctx.quadraticCurveTo(200, this.canvas.height * 0.4, 400, this.canvas.height * 0.45)
    ctx.quadraticCurveTo(600, this.canvas.height * 0.5, 800, this.canvas.height * 0.42)
    ctx.lineTo(this.canvas.width, this.canvas.height * 0.6)
    ctx.lineTo(0, this.canvas.height * 0.6)
    ctx.closePath()
    ctx.fill()

    // Draw grass field
    const grassGradient = ctx.createLinearGradient(0, this.canvas.height * 0.6, 0, this.canvas.height)
    grassGradient.addColorStop(0, "#32CD32") // Lime green
    grassGradient.addColorStop(1, "#228B22") // Forest green
    ctx.fillStyle = grassGradient
    ctx.fillRect(0, this.canvas.width, this.canvas.height * 0.6, this.canvas.height * 0.4)

    // Draw sun
    ctx.fillStyle = "#FFD700"
    ctx.beginPath()
    ctx.arc(650, 80, 40, 0, Math.PI * 2)
    ctx.fill()

    // Draw sun rays
    ctx.strokeStyle = "#FFD700"
    ctx.lineWidth = 3
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8
      const startX = 650 + Math.cos(angle) * 50
      const startY = 80 + Math.sin(angle) * 50
      const endX = 650 + Math.cos(angle) * 70
      const endY = 80 + Math.sin(angle) * 70
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
    }

    // Draw fluffy clouds
    this.drawCloud(150, 100, 60)
    this.drawCloud(450, 120, 45)
    this.drawCloud(700, 90, 50)

    // Draw small flowers (fixed positions to prevent "raining" effect)
    const flowerPositions = [
      { x: 120, y: 450 },
      { x: 280, y: 480 },
      { x: 380, y: 460 },
      { x: 520, y: 470 },
      { x: 680, y: 455 },
      { x: 750, y: 485 },
      { x: 50, y: 475 },
      { x: 420, y: 490 },
    ]

    for (const flower of flowerPositions) {
      this.drawFlower(flower.x, flower.y)
    }
  }

  private drawCloud(x: number, y: number, size: number) {
    const ctx = this.ctx
    ctx.fillStyle = "#FFFFFF"

    // Draw multiple overlapping circles to create a fluffy cloud
    ctx.beginPath()
    ctx.arc(x - size * 0.5, y, size * 0.6, 0, Math.PI * 2)
    ctx.arc(x, y - size * 0.3, size * 0.8, 0, Math.PI * 2)
    ctx.arc(x + size * 0.5, y, size * 0.6, 0, Math.PI * 2)
    ctx.arc(x - size * 0.2, y + size * 0.2, size * 0.5, 0, Math.PI * 2)
    ctx.arc(x + size * 0.2, y + size * 0.2, size * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawFlower(x: number, y: number) {
    const ctx = this.ctx

    // Flower stem
    ctx.strokeStyle = "#228B22"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y - 8)
    ctx.stroke()

    // Flower petals
    ctx.fillStyle = "#FF69B4"
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5
      const petalX = x + Math.cos(angle) * 4
      const petalY = y - 8 + Math.sin(angle) * 4
      ctx.beginPath()
      ctx.arc(petalX, petalY, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Flower center
    ctx.fillStyle = "#FFD700"
    ctx.beginPath()
    ctx.arc(x, y - 8, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawWindIndicator() {
    if (this.difficulty !== "extreme") return

    const ctx = this.ctx
    const flagX = this.canvas.width - 120
    const flagY = 80

    // Draw flag pole
    ctx.strokeStyle = "#8B4513"
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(flagX, flagY)
    ctx.lineTo(flagX, flagY + 80)
    ctx.stroke()

    // Calculate flag animation based on wind
    const windStrength = this.wind.strength
    const windAngle = this.wind.direction
    const flagLength = 40 + windStrength * 20
    const flagHeight = 25

    // Flag waving animation
    const time = Date.now() * 0.005
    const wave = Math.sin(time + windStrength * 3) * windStrength * 5

    // Draw flag (red)
    ctx.fillStyle = "#FF4444"
    ctx.beginPath()
    ctx.moveTo(flagX, flagY)
    ctx.lineTo(flagX + flagLength * Math.cos(windAngle) + wave, flagY + flagLength * Math.sin(windAngle))
    ctx.lineTo(flagX + flagLength * Math.cos(windAngle) + wave, flagY + flagLength * Math.sin(windAngle) + flagHeight)
    ctx.lineTo(flagX, flagY + flagHeight)
    ctx.closePath()
    ctx.fill()

    // Flag outline
    ctx.strokeStyle = "#CC0000"
    ctx.lineWidth = 2
    ctx.stroke()

    // Wind strength indicator
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(flagX - 60, flagY + 90, 120, 40)

    ctx.fillStyle = "white"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText("WIND", flagX, flagY + 105)

    const windDirection = this.getWindDirectionText()
    ctx.fillText(windDirection, flagX, flagY + 118)

    const strengthText = `${Math.round(windStrength * 100)}%`
    ctx.fillText(strengthText, flagX, flagY + 130)

    ctx.textAlign = "left"
  }

  private getWindDirectionText(): string {
    const angle = this.wind.direction
    const degrees = ((angle * 180) / Math.PI + 360) % 360

    if (degrees >= 337.5 || degrees < 22.5) return "E →"
    if (degrees >= 22.5 && degrees < 67.5) return "SE ↘"
    if (degrees >= 67.5 && degrees < 112.5) return "S ↓"
    if (degrees >= 112.5 && degrees < 157.5) return "SW ↙"
    if (degrees >= 157.5 && degrees < 202.5) return "W ←"
    if (degrees >= 202.5 && degrees < 247.5) return "NW ↖"
    if (degrees >= 247.5 && degrees < 292.5) return "N ↑"
    if (degrees >= 292.5 && degrees < 337.5) return "NE ↗"
    return "E →"
  }

  private drawMenuScreen() {
    const ctx = this.ctx
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Draw the title image as background if loaded
    if (this.titleImage && this.titleImage.complete) {
      // Scale and center the image to fit the canvas
      const imageAspect = this.titleImage.width / this.titleImage.height
      const canvasAspect = this.canvas.width / this.canvas.height

      let drawWidth, drawHeight, drawX, drawY

      if (imageAspect > canvasAspect) {
        // Image is wider than canvas
        drawWidth = this.canvas.width
        drawHeight = this.canvas.width / imageAspect
        drawX = 0
        drawY = (this.canvas.height - drawHeight) / 2
      } else {
        // Image is taller than canvas
        drawHeight = this.canvas.height
        drawWidth = this.canvas.height * imageAspect
        drawX = (this.canvas.width - drawWidth) / 2
        drawY = 0
      }

      ctx.drawImage(this.titleImage, drawX, drawY, drawWidth, drawHeight)
    } else {
      // Fallback to original background if image not loaded
      this.drawBackground()

      // Semi-transparent overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      // Game title
      ctx.fillStyle = "#FFD700"
      ctx.font = "bold 72px Arial"
      ctx.textAlign = "center"
      ctx.fillText("MOTHERSHUCKER", centerX, centerY - 100)

      // Subtitle
      ctx.fillStyle = "white"
      ctx.font = "24px Arial"
      ctx.fillText("The Ultimate Cornhole Challenge", centerX, centerY - 50)

      // Goal text
      ctx.font = "18px Arial"
      ctx.fillText("Get as close to 21 points as possible!", centerX, centerY - 10)
    }

    // Replace the existing Play button drawing code with:
    // Play button with hover effects - bottom left, stacked vertically
    const playButtonX = 60
    const playButtonY = this.canvas.height - 160
    const playButtonWidth = 100
    const playButtonHeight = 40

    // Calculate hover effects
    const playHovered = this.hoveredButton === "play"
    const playWiggle = playHovered ? Math.sin(this.buttonAnimationTime * 8) * 2 : 0
    const playGlow = playHovered ? 0.3 + Math.sin(this.buttonAnimationTime * 6) * 0.2 : 0
    const playScale = playHovered ? 1.05 : 1.0

    ctx.save()
    ctx.translate(playButtonX + playButtonWidth / 2, playButtonY + playButtonHeight / 2)
    ctx.scale(playScale, playScale)
    ctx.rotate(playWiggle * 0.05)

    // Glow effect
    if (playHovered) {
      ctx.shadowColor = "#FFD700"
      ctx.shadowBlur = 20 + Math.sin(this.buttonAnimationTime * 4) * 10
    }

    // Yellow center
    ctx.fillStyle = playHovered ? `rgba(255, 215, 0, ${0.9 + playGlow})` : "#FFD700"
    ctx.fillRect(-playButtonWidth / 2, -playButtonHeight / 2, playButtonWidth, playButtonHeight)

    // Red border (inner)
    ctx.strokeStyle = "#DC143C" // Crimson red to match title
    ctx.lineWidth = 4
    ctx.strokeRect(-playButtonWidth / 2, -playButtonHeight / 2, playButtonWidth, playButtonHeight)

    // Black border (outer)
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    ctx.strokeRect(-playButtonWidth / 2 - 1, -playButtonHeight / 2 - 1, playButtonWidth + 2, playButtonHeight + 2)

    ctx.shadowBlur = 0
    ctx.fillStyle = "#000000"
    ctx.font = playHovered ? "bold 20px Arial" : "bold 18px Arial"
    ctx.textAlign = "center"
    ctx.fillText("PLAY", 0, 5)

    ctx.restore()

    // Rules button with hover effects - below Play button
    const rulesButtonX = 60
    const rulesButtonY = this.canvas.height - 110
    const rulesButtonWidth = 100
    const rulesButtonHeight = 40

    const rulesHovered = this.hoveredButton === "rules"
    const rulesWiggle = rulesHovered ? Math.sin(this.buttonAnimationTime * 8) * 2 : 0
    const rulesGlow = rulesHovered ? 0.3 + Math.sin(this.buttonAnimationTime * 6) * 0.2 : 0
    const rulesScale = rulesHovered ? 1.05 : 1.0

    ctx.save()
    ctx.translate(rulesButtonX + rulesButtonWidth / 2, rulesButtonY + rulesButtonHeight / 2)
    ctx.scale(rulesScale, rulesScale)
    ctx.rotate(rulesWiggle * 0.05)

    // Glow effect
    if (rulesHovered) {
      ctx.shadowColor = "#FFD700"
      ctx.shadowBlur = 20 + Math.sin(this.buttonAnimationTime * 4) * 10
    }

    // Yellow center
    ctx.fillStyle = rulesHovered ? `rgba(255, 215, 0, ${0.9 + rulesGlow})` : "#FFD700"
    ctx.fillRect(-rulesButtonWidth / 2, -rulesButtonHeight / 2, rulesButtonWidth, rulesButtonHeight)

    // Red border (inner)
    ctx.strokeStyle = "#DC143C" // Crimson red to match title
    ctx.lineWidth = 4
    ctx.strokeRect(-rulesButtonWidth / 2, -rulesButtonHeight / 2, rulesButtonWidth, rulesButtonHeight)

    // Black border (outer)
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    ctx.strokeRect(-rulesButtonWidth / 2 - 1, -rulesButtonHeight / 2 - 1, rulesButtonWidth + 2, rulesButtonHeight + 2)

    ctx.shadowBlur = 0
    ctx.fillStyle = "#000000"
    ctx.font = rulesHovered ? "bold 18px Arial" : "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.fillText("RULES", 0, 5)

    ctx.restore()

    ctx.textAlign = "left"
  }

  private drawDifficultyScreen() {
    const ctx = this.ctx
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Draw background first
    this.drawBackground()

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Title
    ctx.fillStyle = "#FFD700"
    ctx.font = "bold 48px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Choose Difficulty", centerX, centerY - 100)

    // Easy button
    const easyButtonX = centerX - 220
    const easyButtonY = centerY + 20
    const easyButtonWidth = 90
    const easyButtonHeight = 40

    ctx.fillStyle = "#32CD32"
    ctx.fillRect(easyButtonX, easyButtonY, easyButtonWidth, easyButtonHeight)
    ctx.strokeStyle = "#228B22"
    ctx.lineWidth = 3
    ctx.strokeRect(easyButtonX, easyButtonY, easyButtonWidth, easyButtonHeight)

    ctx.fillStyle = "white"
    ctx.font = "bold 16px Arial"
    ctx.fillText("Easy", easyButtonX + easyButtonWidth / 2, easyButtonY + 25)

    // Medium button
    const mediumButtonX = centerX - 120
    const mediumButtonY = centerY + 20
    const mediumButtonWidth = 90
    const mediumButtonHeight = 40

    ctx.fillStyle = "#FFA500"
    ctx.fillRect(mediumButtonX, mediumButtonY, mediumButtonWidth, mediumButtonHeight)
    ctx.strokeStyle = "#FF8C00"
    ctx.lineWidth = 3
    ctx.strokeRect(mediumButtonX, mediumButtonY, mediumButtonWidth, mediumButtonHeight)

    ctx.fillStyle = "white"
    ctx.font = "bold 16px Arial"
    ctx.fillText("Medium", mediumButtonX + mediumButtonWidth / 2, mediumButtonY + 25)

    // Hard button
    const hardButtonX = centerX - 20
    const hardButtonY = centerY + 20
    const hardButtonWidth = 90
    const hardButtonHeight = 40

    ctx.fillStyle = "#FF4444"
    ctx.fillRect(hardButtonX, hardButtonY, hardButtonWidth, hardButtonHeight)
    ctx.strokeStyle = "#CC0000"
    ctx.lineWidth = 3
    ctx.strokeRect(hardButtonX, hardButtonY, hardButtonWidth, hardButtonHeight)

    ctx.fillStyle = "white"
    ctx.font = "bold 16px Arial"
    ctx.fillText("Hard", hardButtonX + hardButtonWidth / 2, hardButtonY + 25)

    // Extreme button
    const extremeButtonX = centerX + 80
    const extremeButtonY = centerY + 20
    const extremeButtonWidth = 90
    const extremeButtonHeight = 40

    ctx.fillStyle = "#8B0000"
    ctx.fillRect(extremeButtonX, extremeButtonY, extremeButtonWidth, extremeButtonHeight)
    ctx.strokeStyle = "#660000"
    ctx.lineWidth = 3
    ctx.strokeRect(extremeButtonX, extremeButtonY, extremeButtonWidth, extremeButtonHeight)

    ctx.fillStyle = "white"
    ctx.font = "bold 14px Arial"
    ctx.fillText("Extreme", extremeButtonX + extremeButtonWidth / 2, extremeButtonY + 25)

    // Back button
    const backButtonX = centerX - 50
    const backButtonY = centerY + 100
    const backButtonWidth = 100
    const backButtonHeight = 40

    ctx.fillStyle = "#666666"
    ctx.fillRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight)
    ctx.strokeStyle = "#444444"
    ctx.lineWidth = 3
    ctx.strokeRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight)

    ctx.fillStyle = "white"
    ctx.font = "bold 18px Arial"
    ctx.fillText("Back", backButtonX + backButtonWidth / 2, backButtonY + 25)

    ctx.textAlign = "left"
  }

  private drawInstructionsScreen() {
    const ctx = this.ctx
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Draw background first
    this.drawBackground()

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)"
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Title
    ctx.fillStyle = "#FFD700"
    ctx.font = "bold 48px Arial"
    ctx.textAlign = "center"
    ctx.fillText("How to Play", centerX, centerY - 180)

    // Instructions
    ctx.fillStyle = "white"
    ctx.font = "18px Arial"
    const instructions = [
      "OBJECTIVE: Get as close to 21 points as possible!",
      "",
      "CONTROLS:",
      "• Move your mouse to aim your throw",
      "• Click to release the bean bag",
      "• Move mouse during flight to control trajectory",
      "",
      "SCORING:",
      "• Landing in the hole = +3 points",
      "• Landing on the board = +1 point",
      "• Missing the board = 0 points",
      "",
      "DIFFICULTY LEVELS:",
      "• Easy: Shows trajectory preview arc",
      "• Medium: No trajectory preview",
      "• Hard: Board moves after each throw",
      "• Extreme: Wind effects + moving board",
    ]

    let yOffset = centerY - 150
    for (const line of instructions) {
      ctx.fillText(line, centerX, yOffset)
      yOffset += 20
    }

    // Back button
    const backButtonX = centerX - 50
    const backButtonY = centerY + 220
    const backButtonWidth = 100
    const backButtonHeight = 40

    ctx.fillStyle = "#FF6B6B"
    ctx.fillRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight)
    ctx.strokeStyle = "#FF4444"
    ctx.lineWidth = 3
    ctx.strokeRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight)

    ctx.fillStyle = "white"
    ctx.font = "bold 18px Arial"
    ctx.fillText("Back", backButtonX + backButtonWidth / 2, backButtonY + 25)

    ctx.textAlign = "left"
  }

  private drawTrajectoryPreview() {
    if (!this.currentBag || !this.isControllingFlight) return

    const ctx = this.ctx
    const bag = this.currentBag

    // Predict landing spot
    const predictedLanding = bag.predictLanding()

    // Draw predicted trajectory
    ctx.strokeStyle = "rgba(255, 255, 0, 0.6)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()

    const steps = 20
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = bag.x + bag.vx * t * 10
      const y = bag.y + bag.vy * t * 10 + 0.5 * 0.5 * t * t * 100

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Draw predicted landing spot
    if (predictedLanding) {
      ctx.fillStyle = "rgba(255, 255, 0, 0.5)"
      ctx.beginPath()
      ctx.arc(predictedLanding.x, predictedLanding.y, 15, 0, Math.PI * 2)
      ctx.fill()

      // Show if it's going to be a good shot
      const distToHole = Math.sqrt(
        Math.pow(predictedLanding.x - this.board.holeX, 2) + Math.pow(predictedLanding.y - this.board.holeY, 2),
      )

      if (distToHole <= this.board.holeRadius) {
        ctx.strokeStyle = "#FFD700"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(this.board.holeX, this.board.holeY, this.board.holeRadius + 5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  private drawAimingPreview() {
    if (this.gameState !== "aiming") return

    const ctx = this.ctx
    const startX = this.throwOrigin.x - 30 // Match thrower's X position
    const startY = this.throwOrigin.y - 50 // Match thrower's hand position

    // Draw aiming line to mouse
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(this.mouseX, this.mouseY)
    ctx.stroke()
    ctx.setLineDash([])

    // Only draw trajectory arc preview in Easy mode
    if (this.difficulty === "easy") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 3
      ctx.setLineDash([10, 5])
      ctx.beginPath()

      const steps = 30
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        let x = startX + Math.cos(this.currentAngle) * t * this.currentPower * 400
        let y = startY - Math.sin(this.currentAngle) * t * this.currentPower * 400 + t * t * 200

        // Apply wind effect to preview in extreme mode
        if (this.difficulty === "extreme") {
          x += this.wind.x * t * 200
          y += this.wind.y * t * 200
        }

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw power indicator at mouse position
    ctx.fillStyle = `rgba(255, 255, 0, ${0.5 + this.currentPower * 0.5})`
    ctx.beginPath()
    ctx.arc(this.mouseX, this.mouseY, 8 + this.currentPower * 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "rgba(255, 255, 255, 1)"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw crosshair at mouse
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(this.mouseX - 10, this.mouseY)
    ctx.lineTo(this.mouseX + 10, this.mouseY)
    ctx.moveTo(this.mouseX, this.mouseY - 10)
    ctx.lineTo(this.mouseX, this.mouseY + 10)
    ctx.stroke()
  }

  private drawUI() {
    if (this.gameState !== "aiming" && this.gameState !== "throwing") return

    const ctx = this.ctx

    // Score
    ctx.fillStyle = "#333"
    ctx.font = "bold 24px Arial"
    ctx.fillText(`Score: ${this.score}`, 20, 40)

    // Throws remaining
    ctx.fillText(`Throws: ${this.throwsRemaining}`, 20, 70)

    // Difficulty indicator
    ctx.fillStyle = "#666"
    ctx.font = "16px Arial"
    ctx.fillText(`Difficulty: ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)}`, 20, 100)

    // Power indicator
    if (this.gameState === "aiming") {
      ctx.fillText("Move mouse to aim, click to throw!", 20, 120)
      ctx.fillText(`Power: ${Math.round(this.currentPower * 100)}%`, 20, 140)
      ctx.fillText(`Angle: ${Math.round((this.currentAngle * 180) / Math.PI)}°`, 20, 160)
    } else if (this.gameState === "throwing" && this.isControllingFlight) {
      ctx.fillText("Move mouse to control flight!", 20, 120)
    }
  }

  private drawGameOverScreen() {
    const ctx = this.ctx

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Game over text
    ctx.fillStyle = "white"
    ctx.font = "bold 48px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Game Over!", this.canvas.width / 2, this.canvas.height / 2 - 60)

    ctx.font = "bold 32px Arial"
    ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 - 10)

    // Difficulty completed
    ctx.font = "24px Arial"
    ctx.fillText(
      `${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)} Mode Completed`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 20,
    )

    if (this.score === 21) {
      ctx.fillStyle = "#FFD700"
      ctx.font = "bold 28px Arial"
      ctx.fillText("🎉 PERFECT SCORE! 🎉", this.canvas.width / 2, this.canvas.height / 2 + 50)
    }

    ctx.fillStyle = "white"
    ctx.font = "20px Arial"
    ctx.fillText("Click to return to menu", this.canvas.width / 2, this.canvas.height / 2 + 100)

    ctx.textAlign = "left"
  }

  private drawBags() {
    // Draw landed bags
    this.bags.forEach((bag) => bag.draw(this.ctx))

    // Draw current flying bag
    if (this.currentBag) {
      this.currentBag.draw(this.ctx)
    }
  }

  private update() {
    if (this.gameState === "throwing") {
      this.updateBag()
    }

    // Update wind in extreme mode
    if (this.difficulty === "extreme") {
      this.updateWind()
    }

    // Update button animation
    if (this.gameState === "menu") {
      this.buttonAnimationTime += 0.2
    }
  }

  private draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    if (this.gameState === "menu") {
      this.drawMenuScreen()
    } else if (this.gameState === "difficulty") {
      this.drawDifficultyScreen()
    } else if (this.gameState === "instructions") {
      this.drawInstructionsScreen()
    } else if (this.gameState === "gameOver") {
      // Draw background and game elements first
      this.drawBackground()
      this.drawBoard()
      this.drawBags()
      // Then draw game over overlay
      this.drawGameOverScreen()
    } else {
      // Draw game elements
      this.drawBackground()
      this.drawBoard()
      this.drawThrower()
      this.drawWindIndicator() // Add wind indicator
      this.drawAimingPreview()
      this.drawTrajectoryPreview()
      this.drawBags()
      this.drawUI()
      this.drawBoard()
      this.drawThrower()
      this.drawWindIndicator() // Add wind indicator
      this.drawAimingPreview()
      this.drawTrajectoryPreview()
      this.drawBags()
      this.drawUI()
    }
  }

  private gameLoop() {
    this.update()
    this.draw()
    this.animationId = requestAnimationFrame(() => this.gameLoop())
  }

  private restart() {
    this.gameState = "menu"
  }

  public start() {
    this.gameLoop()
  }

  public cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
  }

  private drawThrower() {
    if (this.gameState !== "aiming" && this.gameState !== "throwing") return

    const ctx = this.ctx
    const throwerX = this.throwOrigin.x - 30 // Position thrower to the left of throw origin
    const throwerY = this.throwOrigin.y - 90 // Position thrower above ground (adjusted for bigger size)

    // Determine throwing animation state
    const isThrowingAnimation =
      this.gameState === "throwing" && this.currentBag && this.currentBag.x < this.throwOrigin.x + 50

    ctx.save()

    // Head (bigger)
    ctx.fillStyle = "#FFDBAC" // Skin tone
    ctx.beginPath()
    ctx.arc(throwerX, throwerY - 60, 18, 0, Math.PI * 2)
    ctx.fill()

    // Hair (ponytail) - bigger
    ctx.fillStyle = "#8B4513" // Brown hair
    ctx.beginPath()
    ctx.arc(throwerX - 3, throwerY - 68, 12, 0, Math.PI * 2)
    ctx.fill()

    // Ponytail - bigger
    ctx.beginPath()
    ctx.ellipse(throwerX - 18, throwerY - 63, 6, 12, -0.3, 0, Math.PI * 2)
    ctx.fill()

    // Body (shirt) - bigger
    ctx.fillStyle = "#FF6B6B" // Red shirt
    ctx.beginPath()
    ctx.ellipse(throwerX, throwerY - 22, 12, 22, 0, 0, Math.PI * 2)
    ctx.fill()

    // Arms - bigger
    const armAngle = isThrowingAnimation ? -0.8 : this.currentAngle * 0.5 // Animate arm based on throw angle
    const armExtension = isThrowingAnimation ? 38 : 30

    // Left arm (non-throwing arm) - bigger
    ctx.strokeStyle = "#FFDBAC"
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(throwerX - 9, throwerY - 30)
    ctx.lineTo(throwerX - 22, throwerY - 15)
    ctx.stroke()

    // Right arm (throwing arm) - bigger
    const armEndX = throwerX + Math.cos(armAngle) * armExtension
    const armEndY = throwerY - 30 + Math.sin(armAngle) * armExtension

    ctx.beginPath()
    ctx.moveTo(throwerX + 9, throwerY - 30)
    ctx.lineTo(armEndX, armEndY)
    ctx.stroke()

    // Hand holding bag (only show if not thrown yet) - bigger
    if (this.gameState === "aiming" || (this.gameState === "throwing" && !isThrowingAnimation)) {
      // Hand - bigger
      ctx.fillStyle = "#FFDBAC"
      ctx.beginPath()
      ctx.arc(armEndX, armEndY, 4, 0, Math.PI * 2)
      ctx.fill()

      // Bean bag in hand - bigger
      ctx.fillStyle = "#8B4513"
      ctx.fillRect(armEndX - 6, armEndY - 6, 12, 12)

      // Bag stitching - bigger
      ctx.strokeStyle = "#654321"
      ctx.lineWidth = 1
      ctx.strokeRect(armEndX - 6, armEndY - 6, 12, 12)
    } else {
      // Empty hand after throw - bigger
      ctx.fillStyle = "#FFDBAC"
      ctx.beginPath()
      ctx.arc(armEndX, armEndY, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legs - bigger
    ctx.strokeStyle = "#4169E1" // Blue pants
    ctx.lineWidth = 9

    // Left leg - bigger
    ctx.beginPath()
    ctx.moveTo(throwerX - 4, throwerY)
    ctx.lineTo(throwerX - 12, throwerY + 38)
    ctx.stroke()

    // Right leg (stepping forward during throw) - bigger
    const legForward = isThrowingAnimation ? 12 : 6
    ctx.beginPath()
    ctx.moveTo(throwerX + 4, throwerY)
    ctx.lineTo(throwerX + legForward, throwerY + 38)
    ctx.stroke()

    // Feet - bigger
    ctx.fillStyle = "#654321" // Brown shoes
    ctx.beginPath()
    ctx.ellipse(throwerX - 12, throwerY + 42, 9, 4, 0, 0, Math.PI * 2)
    ctx.ellipse(throwerX + legForward, throwerY + 42, 9, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }
}

class BeanBag {
  public x: number
  public y: number
  public vx: number
  public vy: number
  private gravity = 0.5
  private bounce = 0.3
  private friction = 0.95
  private scoreType: "hole" | "board" | "miss" | null = null
  private glowTime = 0
  private controlInfluence = 0.1 // How much mouse control affects trajectory
  private windX = 0 // Wind force in X direction
  private windY = 0 // Wind force in Y direction

  constructor(x: number, y: number, vx: number, vy: number) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
  }

  public setWind(windX: number, windY: number) {
    this.windX = windX
    this.windY = windY
  }

  // Make x and y publicly settable for board movement
  public setPosition(x: number, y: number) {
    this.x = x
    this.y = y
  }

  public adjustTrajectory(mouseX: number, mouseY: number) {
    // Calculate desired direction based on mouse position
    const dx = mouseX - this.x
    const dy = mouseY - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      // Normalize and apply influence
      const normalizedDx = dx / distance
      const normalizedDy = dy / distance

      // Adjust velocity slightly towards mouse position
      this.vx += normalizedDx * this.controlInfluence
      this.vy += normalizedDy * this.controlInfluence

      // Limit maximum velocity to prevent crazy speeds
      const maxVel = 20
      const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
      if (currentSpeed > maxVel) {
        this.vx = (this.vx / currentSpeed) * maxVel
        this.vy = (this.vy / currentSpeed) * maxVel
      }
    }
  }

  public predictLanding(): { x: number; y: number } | null {
    // Simple prediction - where will the bag land based on current trajectory
    let predX = this.x
    let predY = this.y
    const predVx = this.vx
    let predVy = this.vy

    // Simulate forward in time
    for (let i = 0; i < 100; i++) {
      predX += predVx + this.windX
      predY += predVy + this.windY
      predVy += this.gravity

      if (predY >= 550) {
        // Ground level
        return { x: predX, y: 550 }
      }
    }

    return null
  }

  public update() {
    // Apply wind force
    this.vx += this.windX
    this.vy += this.windY

    this.x += this.vx
    this.y += this.vy
    this.vy += this.gravity

    // Simple ground collision
    if (this.y >= 550) {
      this.y = 550
      this.vy *= -this.bounce
      this.vx *= this.friction

      if (Math.abs(this.vy) < 1) {
        this.vy = 0
      }
    }

    if (this.glowTime > 0) {
      this.glowTime--
    }
  }

  public setScoreType(type: "hole" | "board" | "miss") {
    this.scoreType = type
    this.glowTime = 60
  }

  public draw(ctx: CanvasRenderingContext2D) {
    // Glow effect for scoring
    if (this.glowTime > 0) {
      const glowAlpha = this.glowTime / 60
      ctx.shadowColor = this.scoreType === "hole" ? "#FFD700" : this.scoreType === "board" ? "#90EE90" : "#FF6B6B"
      ctx.shadowBlur = 20 * glowAlpha
    } else {
      ctx.shadowBlur = 0
    }

    // Bean bag dimensions
    const bagSize = 20
    const halfSize = bagSize / 2

    // Add slight rotation for more natural look
    const rotation = Math.sin(this.x * 0.1) * 0.1

    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(rotation)

    // Bean bag shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
    ctx.fillRect(-halfSize + 2, -halfSize + 2, bagSize, bagSize)

    // Main bean bag body (fabric-like brown)
    ctx.fillStyle = "#8B4513"
    ctx.fillRect(-halfSize, -halfSize, bagSize, bagSize)

    // Fabric highlight (lighter brown)
    ctx.fillStyle = "#A0522D"
    ctx.fillRect(-halfSize + 2, -halfSize + 2, bagSize - 6, bagSize - 6)

    // Add stitching lines around the edges
    ctx.strokeStyle = "#654321"
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])

    // Top stitching
    ctx.beginPath()
    ctx.moveTo(-halfSize + 2, -halfSize + 2)
    ctx.lineTo(halfSize - 2, -halfSize + 2)
    ctx.stroke()

    // Bottom stitching
    ctx.beginPath()
    ctx.moveTo(-halfSize + 2, halfSize - 2)
    ctx.lineTo(halfSize - 2, halfSize - 2)
    ctx.stroke()

    // Left stitching
    ctx.beginPath()
    ctx.moveTo(-halfSize + 2, -halfSize + 2)
    ctx.lineTo(-halfSize + 2, halfSize - 2)
    ctx.stroke()

    // Right stitching
    ctx.beginPath()
    ctx.moveTo(halfSize - 2, -halfSize + 2)
    ctx.lineTo(halfSize - 2, halfSize - 2)
    ctx.stroke()

    ctx.setLineDash([]) // Reset line dash

    // Add fabric texture with small dots
    ctx.fillStyle = "rgba(139, 69, 19, 0.3)"
    for (let i = 0; i < 8; i++) {
      const dotX = (Math.random() - 0.5) * (bagSize - 8)
      const dotY = (Math.random() - 0.5) * (bagSize - 8)
      ctx.beginPath()
      ctx.arc(dotX, dotY, 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Add slight "floppy" deformation by drawing a subtle inner shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)"
    ctx.beginPath()
    ctx.ellipse(0, 0, halfSize - 3, halfSize - 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    // Reset shadow
    ctx.shadowBlur = 0

    // Score indicator (keep this the same)
    if (this.scoreType && this.glowTime > 30) {
      ctx.fillStyle = this.scoreType === "hole" ? "#FFD700" : this.scoreType === "board" ? "#90EE90" : "#FF6B6B"
      ctx.font = "bold 16px Arial"
      ctx.textAlign = "center"
      const text = this.scoreType === "hole" ? "+3" : this.scoreType === "board" ? "+1" : "0"
      ctx.fillText(text, this.x, this.y - 25)
      ctx.textAlign = "left"
    }
  }
}
