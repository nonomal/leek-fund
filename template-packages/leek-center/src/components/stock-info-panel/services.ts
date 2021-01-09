import { LeekTreeItem } from '@/../types/shim-background';
import { fetchHexin } from '@/utils/fetch';
import { useEffect, useState } from 'react';
import curry from 'lodash/curry';
import { CurriedFunction2, CurriedFunction4 } from 'lodash';

const getXinheResultValueCurry: CurriedFunction4<
  string[],
  any,
  number,
  string,
  XinHeResultRowValueType
> = curry(
  (
    indexId: string[],
    result: any,
    resultIndex: number,
    key: string,
    option: { title?: string } = {}
  ) => {
    const idIndex = indexId.indexOf(key);
    const placehold = {
      key,
      title: key,
      value: '--',
    };
    if (idIndex < 0) return placehold;
    if (result.result?.[resultIndex]?.[idIndex]) {
      let title = result.title?.[idIndex] ?? key;
      title = title.split('<br>')[0];
      return {
        key,
        title,
        value: result.result?.[resultIndex]?.[idIndex] ?? '--',
      };
    } else {
      return placehold;
    }
  }
);

function changeRowValueTitle(rv: XinHeResultRowValueType, title: string) {
  if (rv) {
    rv.title = title;
  }
  return rv;
}

/**
 * 获取热度数据
 * @param stockName
 * @returns
 */
async function getHotData(stockName: string) {
  const res = await fetchHexin({
    url: 'http://www.iwencai.com/stockpick/load-data',
    method: 'GET',
    params: {
      typed: 0,
      ts: 1,
      f: 1,
      querytype: 'stock',
      w: stockName + '市场热度；撑压位；机构评估',
    },
  });
  console.log('res: ', res);
  const { data } = res;
  try {
    if (data.success && data.data.result.result.length) {
      const { result } = data.data;
      const IndexId = result.indexID;

      const getResultValue = getXinheResultValueCurry(IndexId)(result);

      const getFirstResultValue = getResultValue(0);

      const stockData: StockXinHeDataType = {
        hot: getFirstResultValue('个股热度')?.value,
        ylw: getFirstResultValue('止盈止损(压力位)')?.value,
        zcw: getFirstResultValue('止盈止损(支撑位)')?.value,
        zyw: getFirstResultValue('止盈止损(止盈位)')?.value,
        zsw: getFirstResultValue('止盈止损(止损位)')?.value,
        organizationReports: result.result.map((_r: any, index: number) => [
          getResultValue(index, '最新报告日期'),
          getResultValue(index, '最新研究机构原始评级'),
          getResultValue(index, '上次研究机构原始评级'),
          getResultValue(index, '评级调整方向'),
          getResultValue(index, '研报目标价'),
          getResultValue(index, '研究员姓名'),
          changeRowValueTitle(getResultValue(index, '最新同花顺评级'), '同花顺评级'),
          // getResultValue(index, '上次同花顺评级'),
        ]),
      };
      console.log(stockData);
      return stockData;
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * 获取板块数据
 * @param code
 * @param pid
 * @returns
 */
function getBlockDetail(code: string, pid: number, tid = 137) {
  return fetchHexin({
    url: 'http://www.iwencai.com/diag/block-detail',
    method: 'GET',
    params: {
      pid: pid,
      codes: code,
      codeType: 'stock',
      info: {
        view: {
          nolazy: 1,
          parseArr: {
            _v: 'new',
            dateRange: [],
            staying: [],
            queryCompare: [],
            comparesOfIndex: [],
          },
          asyncParams: { tid: 137 },
        },
      },
    },
  });
}

/**
 * 诊股
 * @param code
 * @returns
 */
async function getNiuxData(code: string) {
  const res = await getBlockDetail(code, 8093);
  console.log('res: ', res);
  const { data } = res;
  if (data.success && data.data.data.result) {
    const _result = data.data.data.result;
    return {
      short: _result._short,
      title: _result._title,
      mid: _result._mid,
      long: _result._long,
      content: _result._content,
      score: _result._score,
    };
  }
  return void 0;
}

/** 概念板块 */
async function getConcept(code: string) {
  const res = await getBlockDetail(code, 10685, 3963);
  console.log('res: ', res);
  const { data } = res;
  if (data.success && data.data.data.result) {
    return data.data.data.result;
  }
  return void 0;
}

export function useXinheData(stock: LeekTreeItem) {
  const [loading, setLoading] = useState<boolean>(false);
  const [xinheData, setXinheData] = useState<StockXinHeDataType>();
  useEffect(() => {
    setXinheData(void 0);
    setLoading(true);
    console.log(`获取：${stock.info.name} hexin 数据`);
    (async function getDatas() {
      try {
        let hotData = await getHotData(stock.info.name);
        hotData = hotData || {};
        if (hotData) {
          hotData.niux = await getNiuxData(stock.info.symbol || stock.info.code);
          hotData.concept = await getConcept(stock.info.symbol || stock.info.code);
          console.log('hotData: ', hotData);
          setXinheData(hotData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [stock.info.code, stock.info.name, stock.info.symbol]);

  return { xinheData, loading };
}
