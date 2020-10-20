export class NumberRange {
  public min: number;
  public max: number;

  constructor(min?: number, max?: number) {
    if (Number(min) && Number(max)){
      if  (min < max){
        this.min = min;
        this.max = max;
      } else {
        this.min = max;
        this.max = min;
      }
    } else {
      this.min = 0;
      this.max = 100;
    }
  }
}
