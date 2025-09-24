import { BingoWord } from "@/models/Room";

export const shuffleArray = (arr: number[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

export const createBoard = (type: '5x5' | '5x10') => {
    const max = type === '5x5' ? 25 : 50
    const num = Array.from({ length: max }, (_, i) => i + 1)
    shuffleArray(num)
    const grid: number[][] = []
    const cols = type === '5x5' ? 5 : 10
    for (let r = 0; r < 5; r++) grid.push(num.slice(r * cols, r * cols + cols))
    return grid
}

export const getNextBingoLetter = (bingoWord: BingoWord): keyof BingoWord | null => {
    const letters: (keyof BingoWord)[] = ['B', 'I', 'N', 'G', 'O']

    for (const letter of letters) {
        if (!bingoWord[letter]) {
            return letter
        }
    }

    return null // All letters are already struck
}

export const strikeBingoLetter = (bingoWord: BingoWord): { updatedBingoWord: BingoWord; struckLetter: keyof BingoWord | null } => {
    const nextLetter = getNextBingoLetter(bingoWord)

    if (!nextLetter) {
        return { updatedBingoWord: bingoWord, struckLetter: null }
    }

    const updatedBingoWord = { ...bingoWord }
    updatedBingoWord[nextLetter] = true

    return { updatedBingoWord, struckLetter: nextLetter }
}

export const isBingoWordComplete = (bingoWord: BingoWord): boolean => {
    return Object.values(bingoWord).every((struck) => struck === true)
}

export const getBingoWordProgress = (bingoWord: BingoWord): { total: number; completed: number; percentage: number } => {
    const completed = Object.values(bingoWord).filter((struck) => struck).length
    const total = 5
    const percentage = Math.round((completed / total) * 100)

    return { total, completed, percentage }
}
