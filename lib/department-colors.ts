// Department color system with curated, modern palette
export interface DepartmentColorConfig {
  bg: string
  border: string
  text: string
  accent: string
}

type DepartmentPaletteColor = {
  bg: string
  border: string
  text: string
  accentFrom: string
  accentTo: string
}

const departmentColorPalette: DepartmentPaletteColor[] = [
  {
    bg: "0.90_0.08_32",
    border: "0.72_0.15_32",
    text: "0.36_0.04_32",
    accentFrom: "0.96_0.06_32",
    accentTo: "0.78_0.12_32",
  },
  {
    bg: "0.88_0.10_72",
    border: "0.70_0.16_72",
    text: "0.34_0.05_72",
    accentFrom: "0.95_0.08_72",
    accentTo: "0.75_0.13_72",
  },
  {
    bg: "0.89_0.09_120",
    border: "0.71_0.14_120",
    text: "0.33_0.04_120",
    accentFrom: "0.96_0.07_120",
    accentTo: "0.77_0.12_120",
  },
  {
    bg: "0.90_0.08_160",
    border: "0.72_0.13_160",
    text: "0.34_0.03_160",
    accentFrom: "0.96_0.06_160",
    accentTo: "0.78_0.10_160",
  },
  {
    bg: "0.89_0.09_210",
    border: "0.70_0.14_210",
    text: "0.33_0.04_210",
    accentFrom: "0.95_0.07_210",
    accentTo: "0.77_0.12_210",
  },
  {
    bg: "0.88_0.09_250",
    border: "0.69_0.15_250",
    text: "0.35_0.04_250",
    accentFrom: "0.95_0.07_250",
    accentTo: "0.76_0.13_250",
  },
  {
    bg: "0.87_0.10_300",
    border: "0.68_0.16_300",
    text: "0.34_0.05_300",
    accentFrom: "0.94_0.08_300",
    accentTo: "0.74_0.14_300",
  },
  {
    bg: "0.89_0.09_345",
    border: "0.71_0.15_345",
    text: "0.35_0.05_345",
    accentFrom: "0.96_0.07_345",
    accentTo: "0.78_0.13_345",
  },
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getDepartmentColor(departmentName: string): DepartmentColorConfig {
  const safeName = departmentName || "未設定"
  const hash = hashString(safeName)
  const palette = departmentColorPalette[hash % departmentColorPalette.length]

  return {
    bg: `bg-[oklch(${palette.bg})]`,
    border: `border-[oklch(${palette.border})]`,
    text: `text-[oklch(${palette.text})]`,
    accent: `from-[oklch(${palette.accentFrom})] to-[oklch(${palette.accentTo})]`,
  }
}



