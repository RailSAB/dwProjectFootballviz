let clubInfo = [];
let countryInfo = [];
let dataByMeasure = {};
let xMeasure = "teamCost";
let yMeasure = "titles";
const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
let currentYear = 2015;
let previousYear = 2015;
let selectedClub = null;
let previousSelectedClub = null;
let isTimelineRunning = false;
let axisChanged = false;
let colorScale;
let selectedCountry = "all";

const margin = { top: 50, right: 50, bottom: 70, left: 70 };

const width = 800;
const height = 450;

const svg = d3
  .select("#scatter-plot")
  .attr("width", width)
  .attr("height", height);

svg.append("g").attr("class", "x-axis");
svg.append("g").attr("class", "y-axis");
const gridContainer = svg.append("g").attr("class", "grid-container");

let xScale = d3.scaleLinear().range([margin.left, width - margin.right]);
let yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);

const yAxisSelect = document.getElementById("y-axis-select");
const xAxisSelect = document.getElementById("x-axis-select");

const trajectoryContainer = svg.append("g").attr("class", "trajectory-container");
const toggleTrajectoryCheckbox = document.getElementById('toggle-trajectory');
let showTrajectory = toggleTrajectoryCheckbox.checked;

let trajectoryData = [];
let clubNameMapping = {};
let countryNameMapping = {};

// Load the club name mapping
d3.json("data/club_name_mapping.json").then((mappingData) => {
  clubNameMapping = Object.fromEntries(
    mappingData.map((entry) => [entry.TeamName, entry.TranslatedName])
  );
});

// Load the country name mapping
d3.json("data/country_name_mapping.json").then((mappingData) => {
  countryNameMapping = Object.fromEntries(
    mappingData.map((entry) => [entry.NationalTeamName, entry.TranslatedName])
  );
});

// Helper function to get the English name of a club
function getEnglishClubName(originalName) {
  return clubNameMapping[originalName] || originalName;
}

// Helper function to get the English name of a country
function getEnglishCountryName(originalName) {
  return countryNameMapping[originalName] || originalName;
}

Promise.all([
  d3.json("data/club_info.json"),
  d3.json("data/country_info.json"),
  d3.json("data/average_age_per_team.json"),
  d3.json("data/club_titles.json"),
  d3.json("data/legionnaires_per_team.json"),
  d3.json("data/clubs_and_national_players.json"), 
  d3.json("data/team_size_ratio.json"),
  d3.json("data/total_team_cost.json"),
  d3.json("data/transfer_balance.json"),
  d3.json("data/average_points_per_team.json"),
]).then(([clubInfoData, countryInfoData, ...measureData]) => {
  clubInfo = clubInfoData;
  countryInfo = countryInfoData;

  const countryNames = [...new Set(countryInfo.map((c) => getEnglishCountryName(c.NationalTeamName)))];
  colorScale = d3.scaleOrdinal()
    .domain(countryNames)
    .range(d3.quantize(d3.interpolateRainbow, countryNames.length));

  const countrySelect = document.getElementById("country-select");
  countryNames.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countrySelect.appendChild(option);
  });

  countrySelect.addEventListener("change", (event) => {
    selectedCountry = event.target.value;
    trajectoryContainer.selectAll("path").remove();
    svg.selectAll("circle").attr("opacity", 0.8);
    selectedClub = null;

    d3.select("#scatter-club-info").html(`
      <h3>Click on a club to see details</h3>
    `);
    updateScatterPlot();
  });


  const measureFiles = [
    { key: "averageAge", data: measureData[0], field: "AverageAge" },
    { key: "titles", data: measureData[1], field: "NumberOfTitlesThisYear" },
    { key: "legioners", data: measureData[2], field: "Legioners" },
    { key: "nationalPlayers", data: measureData[3], field: "PlayersInNationalTeam" },
    { key: "teamSizeRatio", data: measureData[4], field: "TeamSizeRatio" },
    { key: "teamCost", data: measureData[5], field: "TeamCost" },
    { key: "transferBalance", data: measureData[6], field: "TransferBalance" },
    { key: "averagePoints", data: measureData[7], field: "AveragePoints" },
  ];

  measureFiles.forEach(({ key, data, field }) => {
    dataByMeasure[key] = d3.group(data, (d) => d.TeamID);
    dataByMeasure[key].forEach((values, teamID) => {
      dataByMeasure[key].set(
        teamID,
        Object.fromEntries(values.map((d) => [d.Year, d[field]]))
      );
    });
  });


  yAxisSelect.disabled = false;

  yAxisSelect.value = "titles";
  xAxisSelect.value = "teamCost";
  xAxisSelect.disabled = false;




  updateScatterPlot();


  const legendContainer = d3.select("#scatter-legend-container");
  legendContainer.selectAll(".legend-item")
  .data(countryNames)
  .enter()
  .append("div")
  .attr("class", "legend-item")
  .each(function (country) {
    const legendItem = d3.select(this);
    legendItem.append("span")
      .style("background-color", colorScale(country))
      .style("display", "inline-block")
      .style("width", "15px")
      .style("height", "15px")
      .style("margin-right", "5px")
      .style("border-radius", "50%");
    legendItem.append("span").text(country);


    legendItem.on("click", () => {
      svg.selectAll("circle")
        .attr("opacity", (d) => {
          const clubCountry = getEnglishCountryName(countryInfo.find((c) => c.ClubIDs.includes(d.TeamID))?.NationalTeamName);
          return clubCountry === country ? 1 : 0.2; 
        });
        trajectoryContainer.selectAll("path").remove();
    });
  });
});


function updateGrid() {
  gridContainer.selectAll(".grid-line").remove();

  gridContainer
    .selectAll(".horizontal-grid-line")
    .data(yScale.ticks(10))
    .enter()
    .append("line")
    .attr("class", "grid-line horizontal-grid-line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", (d) => yScale(d))
    .attr("y2", (d) => yScale(d))
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4");

  gridContainer
    .selectAll(".vertical-grid-line")
    .data(xScale.ticks(10))
    .enter()
    .append("line")
    .attr("class", "grid-line vertical-grid-line")
    .attr("x1", (d) => xScale(d))
    .attr("x2", (d) => xScale(d))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4");
}

function updateScatterPlot() {
  if (!xMeasure || !yMeasure) {
    svg.selectAll("circle").remove();
    return;
  }

  const xData = dataByMeasure[xMeasure];
  const yData = dataByMeasure[yMeasure];


  const getDomain = (measure, data) => {
    if (measure === "transferBalance") {
      return [-230000, 200000];
    } else if (measure === "legioners") {
      return [0, 50];
    } else if (measure === "teamSizeRatio") {
      return [0, 3.5];
    } else {
      return [
        d3.min([...data.values()].filter(Boolean), (teamData) => d3.min(Object.values(teamData).filter((v) => v !== null && v !== undefined))),
        d3.max([...data.values()].filter(Boolean), (teamData) => d3.max(Object.values(teamData).filter((v) => v !== null && v !== undefined))),
      ];
    }
  };

  const xDomain = getDomain(xMeasure, xData);
  const yDomain = getDomain(yMeasure, yData);

  xScale.domain(xDomain);
  yScale.domain(yDomain);

  svg.select(".x-axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5));

  svg.select(".y-axis")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale));

  updateGrid();
  drawCircles(currentYear);
}

function updateClubInfo(club, year) {
  const country = getEnglishCountryName(
    countryInfo.find((c) =>
      c.ClubIDs.includes(club.TeamID)
    )?.NationalTeamName
  );

  const xValue = dataByMeasure[xMeasure]?.get(club.TeamID)?.[currentYear] || "N/A";
  const yValue = dataByMeasure[yMeasure]?.get(club.TeamID)?.[currentYear] || "N/A";

  const measureMapping = {
    averageAge: "Average age",
    titles: "Number of titles",
    legioners: "Number of legioners",
    nationalPlayers: "Number of national team players",
    teamSizeRatio: "Team size ratio",
    teamCost: "Team cost (in thousands €)",
    transferBalance: "Transfer balance (in thousands €)",
    averagePoints: "Average points per match",
  };

  d3.select("#scatter-club-info").html(`
    <img src="${club.ImageLink}" alt="${getEnglishClubName(club.Team_name)} flag">
    <h3>${getEnglishClubName(club.Team_name)}</h3>
    <p><span>Country:</span> ${country || "Unknown"}</p>
    <p><span>Number of Cups:</span> ${club.NumberOfCups}</p>
    <p><span>${measureMapping[yMeasure]}:</span> ${yValue}</p>
    <p><span>${measureMapping[xMeasure]}:</span> ${xValue}</p>
  `);
}


yAxisSelect.addEventListener("change", () => {
  yMeasure = yAxisSelect.value;
  xAxisSelect.disabled = false;


  xAxisSelect.innerHTML = `
    <option value="" disabled selected>Select X-Axis Measure</option>
  `;
  const xAxisOptions = [
    { value: "nationalPlayers", label: "Number of national team players" },
    { value: "teamCost", label: "Team Cost" },
    { value: "transferBalance", label: "Transfer balance" },
    { value: "legioners", label: "Number of Legioners" },
    { value: "averageAge", label: "Team Average age" },
    { value: "teamSizeRatio", label: "Team size ratio" },
  ];
  xAxisOptions.forEach((option) => {
    if (yMeasure === "transferBalance" && option.value === "transferBalance")
      return;
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    xAxisSelect.appendChild(opt);
  });

  trajectoryData = [];
  trajectoryContainer.selectAll(".new-trajectory").remove();

  updateScatterPlot();


  if (selectedClub) {
    trajectoryData = years.map((year) => ({
      x: xScale(dataByMeasure[xMeasure]?.get(selectedClub.TeamID)?.[year] || 0),
      y: yScale(dataByMeasure[yMeasure]?.get(selectedClub.TeamID)?.[year] || 0),
    }));
    axisChanged = true;
    drawNewTrajectory(currentYear);
  }
});

xAxisSelect.addEventListener("change", () => {
  xMeasure = xAxisSelect.value;


  trajectoryData = [];
  trajectoryContainer.selectAll(".new-trajectory").remove();

  updateScatterPlot();


  if (selectedClub) {
    trajectoryData = years.map((year) => ({
      x: xScale(dataByMeasure[xMeasure]?.get(selectedClub.TeamID)?.[year] || 0),
      y: yScale(dataByMeasure[yMeasure]?.get(selectedClub.TeamID)?.[year] || 0),
    }));

    axisChanged = true;
    drawNewTrajectory(currentYear);
  }
});


const updateDashedLines = (d, year) => {
  svg.selectAll(".dashed-line").remove();

  svg
    .append("line")
    .attr("class", "dashed-line")
    .attr("x1", xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("x2", xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("y1", yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("y2", height - margin.bottom)
    .attr("stroke", "black")
    .attr("stroke-dasharray", "5,5");

  svg
    .append("line")
    .attr("class", "dashed-line")
    .attr("x1", xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("x2", margin.left)
    .attr("y1", yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("y2", yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("stroke", "black")
    .attr("stroke-dasharray", "5,5");
};

const legendContainer = d3.select("#scatter-legend-container");



function drawCircles(year) {
  let circles = svg.selectAll("circle").data(clubInfo.filter((d) => {
    if (selectedCountry === "all") return true;
    const country = getEnglishCountryName(
      countryInfo.find((c) => c.ClubIDs.includes(d.TeamID))?.NationalTeamName
    );
    return country === selectedCountry;
  }), (d) => d.TeamID);

  const maxCups = d3.max(clubInfo, (d) => d.NumberOfCups);
  const minCups = d3.min(clubInfo, (d) => d.NumberOfCups);
  const radiusScale = d3.scaleLinear().domain([minCups, maxCups]).range([3, 15]);

  circles
    .enter()
    .append("circle")
    .attr("r", (d) => radiusScale(d.NumberOfCups))
    .attr("fill", (d) => {
      const country = getEnglishCountryName(
        countryInfo.find((c) => c.ClubIDs.includes(d.TeamID))?.NationalTeamName
      );
      return colorScale(country || "Unknown");
    })
    .attr("stroke", "black")
    .attr("opacity", 0.8)
    .attr("cx", (d) => xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("cy", (d) => yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[year] || 0))
    .on("mouseover", function (event, d) {
      if (isTimelineRunning) return;
      d3.select(this).attr("stroke", "orange").attr("stroke-width", 2);
      updateDashedLines(d, currentYear);
      const textPadding = 5;


      svg.selectAll(".tooltip-text").remove();
      svg.selectAll(".tooltip-bg").remove();


      const xPosition = xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[currentYear] || 0);
      const yPosition = yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[currentYear] || 0) - 20;

      const tempText = svg
        .append("text")
        .attr("x", xPosition)
        .attr("y", yPosition)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "black")
        .text(getEnglishClubName(d.Team_name));

      const bbox = tempText.node().getBBox();

      svg
        .append("rect")
        .attr("class", "tooltip-bg")
        .attr("x", bbox.x - textPadding)
        .attr("y", bbox.y - textPadding)
        .attr("width", bbox.width + 2 * textPadding)
        .attr("height", bbox.height + 2 * textPadding)
        .attr("fill", "white")
        .attr("stroke", "black")
        .attr("rx", 4);

      tempText.raise();
      tempText.attr("class", "tooltip-text");
    })
    .on("mouseout", function () {
      if (isTimelineRunning) return;
      d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
      svg.selectAll(".dashed-line").remove();
      svg.selectAll(".tooltip-text").remove();
      svg.selectAll(".tooltip-bg").remove();
    })
    .on("click", function (event, d) {
      if (isTimelineRunning) return;
      previousSelectedClub = selectedClub;
      selectedClub = d;

      trajectoryData = years.map((year) => ({
        x: xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[year] || 0),
        y: yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[year] || 0),
      }));

      if (selectedClub !== previousSelectedClub) {
        trajectoryContainer.selectAll(".new-trajectory").remove();
        drawNewTrajectory(currentYear);
      }
      updateClubInfo(selectedClub, year);
      svg.selectAll("circle").attr("opacity", 0.2);
      d3.select(this).attr("opacity", 1);
    });

  circles
    .transition()
    .duration(1500)
    .attr("cx", (d) => xScale(dataByMeasure[xMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("cy", (d) => yScale(dataByMeasure[yMeasure]?.get(d.TeamID)?.[year] || 0))
    .attr("fill", (d) => {
      const country = getEnglishCountryName(
        countryInfo.find((c) => c.ClubIDs.includes(d.TeamID))?.NationalTeamName
      );
      return colorScale(country || "Unknown");
    });

  circles.exit().remove();


  if (selectedClub) {
    updateClubInfo(selectedClub, year);
  }
}

svg.on("click", (event) => {
  if (event.target.tagName === "svg") {
    trajectoryContainer.selectAll("path").remove();
    svg.selectAll("circle").attr("opacity", 0.8);
    selectedClub = null;


    d3.select("#scatter-club-info").html(`
      <h3>Click on a club to see details</h3>
    `);
  }
});

toggleTrajectoryCheckbox.addEventListener('change', (event) => {
  showTrajectory = event.target.checked;
  if (!showTrajectory) {
    trajectoryContainer.selectAll(".new-trajectory").remove();
  } else {

    if (selectedClub) {
      drawNewTrajectory(currentYear);
    }
  }
});


const drawNewTrajectory = (year) => {
  if (!showTrajectory) return;
  const partialData = trajectoryData.slice(0, years.indexOf(year) + 1);
  const path = trajectoryContainer
    .append("path")
    .datum(partialData)
    .attr("class", "new-trajectory")
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 2)
    .attr("opacity", 0.6)
    .attr(
      "d",
      d3
        .line()
        .curve(d3.curveCatmullRom)
        .x((d) => d.x)
        .y((d) => d.y)
    );

  if (axisChanged) {
    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", `${totalLength},${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .attr("stroke-dashoffset", 0);
    axisChanged = false
  }
}

const updateTrajectory = (year) => {

  if (trajectoryData.length === 0 || !selectedClub) return;
  if (!showTrajectory) return;

  if (previousYear > currentYear) {
    trajectoryContainer.selectAll(".new-trajectory").remove();
  }

  const partialData = trajectoryData.slice(years.indexOf(year - 1), years.indexOf(year) + 1);

  const path = trajectoryContainer
    .append("path")
    .datum(partialData)
    .attr("class", "new-trajectory")
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 2)
    .attr("opacity", 0.6)
    .attr(
      "d",
      d3
        .line()
        .curve(d3.curveCatmullRom)
        .x((d) => d.x)
        .y((d) => d.y)
    );

  const totalLength = path.node().getTotalLength();

  path
    .attr("stroke-dasharray", `${totalLength},${totalLength}`)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(1500)
    .attr("stroke-dashoffset", 0);

  previousYear = currentYear;
};

const timelineYearsContainer = document.querySelector('.timeline-years');
const playPauseBtn = document.querySelector('.play-pause-btn');
let intervalId = null;


years.forEach((year, index) => {
  const yearElement = document.createElement('span');
  yearElement.textContent = year;
  if (index === 0) {
    yearElement.classList.add('active');
  }
  timelineYearsContainer.appendChild(yearElement);
});

const yearElements = document.querySelectorAll('.timeline-years span');
let currentIndex = 0;


yearElements.forEach((yearElement, index) => {
  yearElement.addEventListener('click', () => {
    if (isTimelineRunning) return;
    document.querySelector('.timeline-years .active').classList.remove('active');
    yearElement.classList.add('active');
    currentIndex = index;
    previousYear = currentYear;
    currentYear = years[currentIndex];
    drawCircles(currentYear);
    updateTrajectoryTimelineYearClick(currentYear);
  });
});

const updateTrajectoryTimelineYearClick = (year) => {
  if (trajectoryData.length === 0 || !selectedClub) return;
  if (!showTrajectory) return;

  let partialData;

  if (previousYear > currentYear) {
    trajectoryContainer.selectAll(".new-trajectory").remove();
    partialData = trajectoryData.slice(0, years.indexOf(year) + 1);
  } else {
    partialData = trajectoryData.slice(years.indexOf(previousYear), years.indexOf(year) + 1);
  }

  const path = trajectoryContainer
    .append("path")
    .datum(partialData)
    .attr("class", "new-trajectory")
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 2)
    .attr("opacity", 0.6)
    .attr(
      "d",
      d3
        .line()
        .curve(d3.curveCatmullRom)
        .x((d) => d.x)
        .y((d) => d.y)
    );

  const totalLength = path.node().getTotalLength();

  path
    .attr("stroke-dasharray", `${totalLength},${totalLength}`)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(1500)
    .attr("stroke-dashoffset", 0);

  updateClubInfo(selectedClub, year);
};


function switchToNextYear() {
  yearElements[currentIndex].classList.remove('active');
  currentIndex = (currentIndex + 1) % yearElements.length;
  yearElements[currentIndex].classList.add('active');
  previousYear = currentYear;
  currentYear = years[currentIndex];
  drawCircles(currentYear);
  if (showTrajectory && selectedClub) {
    updateTrajectory(currentYear);
  }
}


playPauseBtn.addEventListener('click', () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    isTimelineRunning = false;
    playPauseBtn.textContent = '▶';
  } else {
    isTimelineRunning = true;
    intervalId = setInterval(switchToNextYear, 2000);
    playPauseBtn.textContent = '⏸';
  }
});


playPauseBtn.textContent = '▶';
