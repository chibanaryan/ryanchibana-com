import { scaleBand, scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';

interface DataPoint {
  label: string;
  value: number;
}

export function bindChart(container: HTMLElement, data: DataPoint[]) {
  const width = 500;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  select(container).selectAll('*').remove();

  const svg = select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .style('max-width', `${width}px`);

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range([0, innerWidth])
    .padding(0.2);

  const y = scaleLinear()
    .domain([0, Math.max(...data.map((d) => d.value))])
    .nice()
    .range([innerHeight, 0]);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(axisBottom(x));

  g.append('g').call(axisLeft(y));

  g.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d) => x(d.label)!)
    .attr('y', (d) => y(d.value))
    .attr('width', x.bandwidth())
    .attr('height', (d) => innerHeight - y(d.value))
    .attr('fill', '#3a86ff')
    .attr('rx', 3);
}
