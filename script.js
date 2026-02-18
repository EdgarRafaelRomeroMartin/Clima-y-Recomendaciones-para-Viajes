const API_KEY = '0f58b3ffed811400c4f81343a054eef1';

const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const weatherCard = document.getElementById('weather-card');
const favBtn = document.getElementById('fav-btn');
const favList = document.getElementById('fav-list');
const autocompleteList = document.getElementById('autocomplete-list');
const MAX_REintentos = 3;
const TIEMPO_ESPERA_REINTENTO = 1000; 
let fallosConsecutivos = 0;
const LIMITE_FALLOS_CIRCUITO = 5;
let circuitoAbierto = false;
let ciudadActual = "";

searchBtn.addEventListener('click', buscarCiudad);

cityInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        buscarCiudad();
    }
});

cityInput.addEventListener("input", () => {
    const valor = cityInput.value.toLowerCase();
    autocompleteList.innerHTML = "";
    if (valor.length < 2) return;

    let historial = JSON.parse(localStorage.getItem("favoritos")) || [];
    const sugerencias = historial.filter(c => c.toLowerCase().includes(valor));

    sugerencias.forEach(ciudad => {
        const div = document.createElement("div");
        div.innerHTML = `<strong>${ciudad.substr(0, valor.length)}</strong>${ciudad.substr(valor.length)}`;
        div.addEventListener("click", () => {
            cityInput.value = ciudad;
            autocompleteList.innerHTML = "";
            buscarCiudad();
        });
        autocompleteList.appendChild(div);
    });
});

function buscarCiudad() {
    const city = cityInput.value.trim();
    if (city.length < 2) {
        alert("Escribe una ciudad válida");
        return;
    }
    autocompleteList.innerHTML = "";
    fetchWeather(city);
    fetchForecast(city); 
}

async function fetchWeather(city) {
    try {
        const cityEncoded = encodeURIComponent(city);
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${cityEncoded}&units=metric&lang=es&appid=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Ciudad no encontrada");
        const data = await response.json();
        ciudadActual = data.name;
        updateUI(data);
    } catch (err) {
        alert(err.message);
    }
}

async function fetchForecast(city) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&lang=es&appid=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const forecastContainer = document.getElementById('forecast-container');
        forecastContainer.className = "forecast-grid"; 
        forecastContainer.innerHTML = "";

        const diasUnicos = data.list.filter(lectura => lectura.dt_txt.includes("12:00:00"));

        diasUnicos.forEach(dia => {
            const fecha = new Date(dia.dt * 1000);
            const nombreDia = fecha.toLocaleDateString('es-ES', { weekday: 'short' });
            
            forecastContainer.innerHTML += `
                <div class="forecast-item">
                    <p>${nombreDia}</p>
                    <img src="https://openweathermap.org/img/wn/${dia.weather[0].icon}.png" alt="icono">
                    <p><strong>${Math.round(dia.main.temp)}°</strong></p>
                </div>
            `;
        });
    } catch (err) {
        console.error("Error al cargar pronóstico", err);
    }
}
async function fetchWithRetry(url, opciones = {}, reintentos = MAX_REintentos) {
    try {
        const respuesta = await fetch(url, opciones);
        if (!respuesta.ok) throw new Error("Error en la respuesta");
        
        fallosConsecutivos = 0;
        circuitoAbierto = false;
        return await respuesta.json();
    } catch (error) {
        if (reintentos > 0) {
            console.log(`Reintentando... Quedan ${reintentos} intentos.`);
            await new Promise(res => setTimeout(res, TIEMPO_ESPERA_REINTENTO));
            return fetchWithRetry(url, opciones, reintentos - 1);
        }
        throw error;
    }
}

async function fetchWeather(city) {
    if (circuitoAbierto) {
        alert("⚠️ El servicio de clima está pausado temporalmente debido a demasiados errores. Intenta en 1 minuto.");
        return;
    }

    try {
        const cityEncoded = encodeURIComponent(city);
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${cityEncoded}&units=metric&lang=es&appid=${API_KEY}`;

        const data = await fetchWithRetry(url);
        
        ciudadActual = data.name;
        updateUI(data);
        fetchForecast(city); 

    } catch (err) {
        fallosConsecutivos++;
        console.error(`Fallos acumulados: ${fallosConsecutivos}`);

        if (fallosConsecutivos >= LIMITE_FALLOS_CIRCUITO) {
            circuitoAbierto = true;
            setTimeout(() => { 
                circuitoAbierto = false; 
                fallosConsecutivos = 0; 
                console.log("Circuito cerrado de nuevo.");
            }, 60000); 
        }

        alert("No se pudo obtener el clima: " + err.message);
    }
}
function updateUI(data) {
    weatherCard.classList.remove('hidden');
    document.getElementById('city-name').innerText = data.name;
    document.getElementById('temp-display').innerText = Math.round(data.main.temp) + "°C";
    document.getElementById('weather-desc').innerText = data.weather[0].description;
    const iconCode = data.weather[0].icon;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    mostrarRecomendacion(data.weather[0].main);
}

function mostrarRecomendacion(clima) {
    const recContainer = document.getElementById('recommendations');
    const recomendaciones = {
        "Clear": "☀️ Ideal para pasear o ir al parque.",
        "Rain": "☔ Buen día para museos o cafeterías.",
        "Clouds": "☁️ Perfecto para caminar y explorar.",
        "Snow": "❄️ Abrígate bien y disfruta bebidas calientes."
    };
    recContainer.innerHTML = recomendaciones[clima] || "🌤️ Buen día para actividades ligeras.";
}

favBtn.addEventListener("click", () => {
    if (!ciudadActual) return;
    let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
    if (!favoritos.includes(ciudadActual)) {
        favoritos.push(ciudadActual);
        localStorage.setItem("favoritos", JSON.stringify(favoritos));
        mostrarFavoritos();
    }
});

function mostrarFavoritos() {
    favList.innerHTML = "";
    let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];

    favoritos.forEach(ciudad => {
        const li = document.createElement("li");
        li.classList.add("fav-item"); 

        const spanNombre = document.createElement("span");
        spanNombre.textContent = ciudad;
        spanNombre.style.cursor = "pointer";
        spanNombre.addEventListener("click", () => {
            cityInput.value = ciudad;
            buscarCiudad();
        });

        const btnEliminar = document.createElement("button");
        btnEliminar.innerHTML = "&times;"; 
        btnEliminar.classList.add("btn-remove");
        btnEliminar.title = "Eliminar de favoritos";
        btnEliminar.addEventListener("click", (e) => {
            e.stopPropagation(); 
            eliminarFavorito(ciudad);
        });

        li.appendChild(spanNombre);
        li.appendChild(btnEliminar);
        favList.appendChild(li);
    });
}

function eliminarFavorito(ciudad) {
    let favoritos = JSON.parse(localStorage.getItem("favoritos")) || [];
 
    favoritos = favoritos.filter(f => f !== ciudad);
    localStorage.setItem("favoritos", JSON.stringify(favoritos));
    mostrarFavoritos(); 
}

mostrarFavoritos();