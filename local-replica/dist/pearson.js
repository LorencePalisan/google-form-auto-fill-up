// Two-sided Pearson test, H0: population correlation = 0.
// p = I_(1-r*r)((n-2)/2, 1/2), equivalent to Student's t with n-2 df.
globalThis.PearsonAnalysis = (() => {
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
  function logGamma(z) {
    const c = [676.5203681218851,-1259.1392167224028,771.32342877765313,
      -176.61502916214059,12.507343278686905,-0.13857109526572012,
      9.9843695780195716e-6,1.5056327351493116e-7];
    if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
    z -= 1;
    let x = .99999999999980993;
    c.forEach((v,i) => { x += v/(z+i+1); });
    const t = z + 7.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function fraction(a,b,x) {
    const tiny = 1e-300;
    const safe = v => Math.abs(v) < tiny ? (v < 0 ? -tiny : tiny) : v;
    let c=1, d=1/safe(1-(a+b)*x/(a+1)), h=d;
    for (let m=1; m<=10000; m++) {
      let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m));
      d=1/safe(1+aa*d); c=safe(1+aa/c); h*=d*c;
      aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));
      d=1/safe(1+aa*d); c=safe(1+aa/c);
      const delta=d*c; h*=delta;
      if (Math.abs(delta-1)<3e-14) return h;
    }
    throw Error('P-value calculation did not converge.');
  }
  function beta(x,a,b) {
    if (x<=0) return 0;
    if (x>=1) return 1;
    const term=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    return x<(a+1)/(a+b+2) ? term*fraction(a,b,x)/a : 1-term*fraction(b,a,1-x)/b;
  }
  function pearson(x,y) {
    if (x.length!==y.length || [...x,...y].some(v=>!Number.isFinite(v))) throw Error('Expected paired finite numeric scores.');
    const n=x.length;
    const unavailable=reason=>({n,r:null,p:null,df:n>=3?n-2:null,decision:'Not testable',reason});
    if (n<3) return unavailable('At least three paired responses are required.');
    const mx=mean(x),my=mean(y);
    let xx=0,yy=0,xy=0;
    for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;xx+=dx*dx;yy+=dy*dy;xy+=dx*dy;}
    if (xx===0 || yy===0) return unavailable('A variable has zero variance.');
    const r=Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy)));
    const p=Math.max(0,Math.min(1,beta(Math.max(0,1-r*r),(n-2)/2,.5)));
    return {n,r,p,df:n-2,decision:p<=.05?'Reject H0':'Fail to reject H0',reason:null};
  }
  function analyze(rows) {
    if(rows.some(r=>r.length!==22 || r.some(v=>!Number.isInteger(v)||v<1||v>4))) throw Error('Each response must have 22 integer scores from 1 to 4.');
    const y=rows.map(r=>mean(r.slice(14)));
    return [
      ['Social Network',0,14,'Primary hypothesis'],
      ['Brand Visibility',0,4,'Exploratory'],
      ['Sharing',4,9,'Exploratory'],
      ['Relationship',9,14,'Exploratory'],
    ].map(([variable,start,end,role])=>({variable,outcome:'Customer Acquisition',role,...pearson(rows.map(r=>mean(r.slice(start,end))),y)}));
  }
  return {pearson,analyze};
})();
