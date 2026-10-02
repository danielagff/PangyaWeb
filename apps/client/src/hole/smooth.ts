/**
 * Mola criticamente amortecida (a mesma conta do SmoothDamp da Unity): o valor segue o alvo
 * acelerando e freando aos poucos, sem trancos, mesmo quando o alvo muda de repente (um
 * toque de tecla, um recálculo da física). Conta pelo tempo (dt), não pelos quadros: fica
 * igual com 30 ou 144 quadros por segundo.
 */
export class Smooth {
  velocity = 0

  /** `time`: segundos que leva, mais ou menos, para chegar ao alvo. */
  constructor(
    public value: number,
    public time: number,
  ) {}

  update(target: number, dt: number) {
    if (dt <= 0) return this.value
    const omega = 2 / Math.max(this.time, 1e-4)
    const x = omega * dt
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
    const change = this.value - target
    const temp = (this.velocity + omega * change) * dt
    this.velocity = (this.velocity - omega * temp) * decay
    this.value = target + (change + temp) * decay
    return this.value
  }

  /** Vai direto para `value`, parado. */
  snap(value: number) {
    this.value = value
    this.velocity = 0
    return value
  }
}

/** Fração de aproximação de um lerp por quadro (`perFrame` a 60 quadros/s) para um `dt`. */
export const lerpFactor = (perFrame: number, dt: number) => 1 - Math.pow(1 - perFrame, dt * 60)
