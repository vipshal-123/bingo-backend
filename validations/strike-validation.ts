import { Player } from '@/models/Room'
import { isBingoWordComplete } from '@/utils/reUseableFunction'

export const validateRowStrike = (player: Player, rowIndex: number): { valid: boolean; message?: string } => {
    if (rowIndex < 0 || rowIndex >= player.marked.length) {
        return { valid: false, message: 'Invalid row index' }
    }

    if (player.strikes.rows[rowIndex]) {
        return { valid: false, message: 'Row is already struck' }
    }

    const isRowComplete = player.marked[rowIndex].every((cell) => cell === true)
    if (!isRowComplete) {
        return { valid: false, message: 'Row is not complete. All numbers must be marked before striking.' }
    }

    return { valid: true }
}

export const validateColumnStrike = (player: Player, colIndex: number): { valid: boolean; message?: string } => {
    const columnCount = player.boardType === '5x5' ? 5 : 10

    if (colIndex < 0 || colIndex >= columnCount) {
        return { valid: false, message: 'Invalid column index' }
    }

    if (player.strikes.columns[colIndex]) {
        return { valid: false, message: 'Column is already struck' }
    }

    const isColumnComplete = player.marked.every((row) => row[colIndex] === true)
    if (!isColumnComplete) {
        return { valid: false, message: 'Column is not complete. All numbers must be marked before striking.' }
    }

    return { valid: true }
}

export const checkBingoWithStrikes = (player: Player): boolean => {
    let completedLines = 0

    completedLines += player.strikes.rows.filter(Boolean).length

    completedLines += player.strikes.columns.filter(Boolean).length

    for (let i = 0; i < player.marked.length; i++) {
        if (!player.strikes.rows[i] && player.marked[i].every(Boolean)) {
            completedLines++
        }
    }

    const columnCount = player.boardType === '5x5' ? 5 : 10
    for (let col = 0; col < columnCount; col++) {
        if (!player.strikes.columns[col] && player.marked.every((row) => row[col] === true)) {
            completedLines++
        }
    }

    if (player.boardType === '5x5') {
        let mainDiagonalComplete = true
        let antiDiagonalComplete = true

        for (let i = 0; i < 5; i++) {
            if (!player.marked[i][i]) mainDiagonalComplete = false
            if (!player.marked[i][4 - i]) antiDiagonalComplete = false
        }

        if (mainDiagonalComplete) completedLines++
        if (antiDiagonalComplete) completedLines++
    }

    const bingoWordComplete = isBingoWordComplete(player.bingoWord)
    console.log('bingoWordComplete: ', bingoWordComplete)
    console.log('completedLines: ', completedLines)

    return completedLines >= 5 || bingoWordComplete
}
