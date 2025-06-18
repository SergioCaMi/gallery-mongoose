const express = require("express");
const router = express.Router();
const Image = require("../models/image.model");
const getColors = require("get-image-colors");
const fetch = require("node-fetch");
const exifr = require("exifr");

// Función para extraer EXIF
async function extractExifFromUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Error al descargar imagen");
    const buffer = await response.buffer();
    return await exifr.parse(buffer);
  } catch (error) {
    console.error("Error al extraer EXIF:", error);
    return null;
  }
}

// ********** Función para comprobar si los usuarios han hecho login **********
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/");
}

// Función para renderizar con todos los datos necesarios
function getRenderObject(title, dataImage, req, message = undefined, colorMessage = "black", user = null) {
  const userData = user || (
    req.isAuthenticated?.() && 
    req.user && 
    req.user.photos && 
    req.user.photos.length > 0
      ? { photo: req.user.photos[0].value }
      : null
  );

  return {
    title,
    dataImage,
    message,
    colorMessage,
    user: userData
  };
}

// **************************************** Home ****************************************
router.get("/", async (req, res) => {
  try {
    // ******************** Buscamos todas las imagenes ********************

    const dataImage = await Image.find({}).sort({ date: 1 });
    const renderData = getRenderObject("Home", dataImage, req);
    res.render("home.ejs", renderData);
  } catch (error) {
    console.error("Error al obtener imágenes:", error);
    res.status(500).send("Error interno del servidor");
  }
});


// **************************************** Add new image ****************************************
// **************************************** Add new image GET (Mostrar formulario) ****************************************

router.get("/new-image", isAuthenticated, async (req, res) => {
  res.render("addImage.ejs", {
    title: "New Image",
    message: undefined,
    colorMessage: "black",
    user:
      req.isAuthenticated() &&
      req.user &&
      req.user.photos &&
      req.user.photos.length > 0
        ? { photo: req.user.photos[0].value }
        : null,
  });
});

// **************************************** Add new image POST (guardar imagen) ****************************************
router.post("/new-image", async (req, res) => {
  try {
    const existingImage = await Image.findOne({
      urlImagen: req.body.urlImagen,
    });
    if (existingImage) {
      return res.render("addImage.ejs", {
        title: "New Image",
        message: `La imagen "${req.body.title}" ya se encontraba en el archivo.`,
        colorMessage: "red",
        user:
          req.isAuthenticated() &&
          req.user &&
          req.user.photos &&
          req.user.photos.length > 0
            ? { photo: req.user.photos[0].value }
            : null,
      });
    }

    let colors;
    try {
      colors = await getColors(req.body.urlImagen);
    } catch (error) {
      console.error("Error al obtener colores:", error);
      colors = null;
    }

    const exifData = await extractExifFromUrl(req.body.urlImagen);

    const newImage = new Image({
      title: req.body.title,
      urlImagen: req.body.urlImagen,
      date: req.body.date,
      description: req.body.description,
      colors,
      exif: exifData,
    });


    try {
      await newImage.save();
      res.status(201).json({ image: newImage });
    } catch (err) {
        res.status(500).json({ error: err.message });
      return;
    }

    res.render("addImage.ejs", {
      title: "New Image",
      message: `La imagen "${req.body.title}" se ha añadido satisfactoriamente.`,
      colorMessage: "green",
      user:
        req.isAuthenticated() &&
        req.user &&
        req.user.photos &&
        req.user.photos.length > 0
          ? { photo: req.user.photos[0].value }
          : null,
    });
  } catch (error) {
    console.error("Error al añadir imagen:", error);
    res.status(500).send("Error al añadir la imagen");
  }
});

// **************************************** Eliminar imagen ****************************************
router.post("/image/:id/delete", async (req, res) => {
  try {
    await Image.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Imagen eliminada" });
  } catch (error) {
    console.error(`Error al eliminar imagen con id ${req.params.id}:`, error);
    res.status(500).json({ message: "Error al eliminar la imagen" });
  }
});

// **************************************** Visualizar  ****************************************
function renderView(res, ejsFile, title, image, user) {
  res.render(ejsFile, {
    title,
    dataImage: [image],
    index: 0,
    user,
  });
}

router.get("/image/:id/view", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);

    if (!image) return res.status(404).send("Imagen no encontrada");
    renderView(res, "viewImage.ejs", "View", image, req.user);
  } catch (error) {
    console.error("Error al ver imagen:", error);
    res.status(500).send("Error al cargar imagen");
  }
});

// **************************************** Detalles  ****************************************

router.get("/image/:id/details", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).send("Imagen no encontrada");
    renderView(res, "detailsImage.ejs", "Details", image, req.user);
  } catch (error) {
    console.error("Error al mostrar detalles:", error);
    res.status(500).send("Error al mostrar detalles");
  }
});

// **************************************** Editar  ****************************************
// **************************************** Editar  GET (cargar datos antiguos) ****************************************

router.get("/image/:id/edit", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).send("Imagen no encontrada");
    res.render("editImage.ejs", {
      title: "Edit Image",
      image,
      user:
        req.isAuthenticated() &&
        req.user &&
        req.user.photos &&
        req.user.photos.length > 0
          ? { photo: req.user.photos[0].value }
          : null,
    });
  } catch (error) {
    console.error("Error al editar imagen:", error);
    res.status(500).send("Error al editar imagen");
  }
});

// **************************************** Editar POST (guardar nuevos datos) ****************************************

router.post("/edit-image", async (req, res) => {
  try {
    const updatedImage = await Image.findByIdAndUpdate(
      req.body.id,
      {
        title: req.body.title,
        date: req.body.date,
        description: req.body.description,
      },
      { new: true }
    );
    if (!updatedImage) return res.status(404).send("Imagen no encontrada");

    res.redirect("/");
  } catch (error) {
    console.error("Error al actualizar imagen:", error);
    res.status(500).send("Error al actualizar imagen");
  }
});

// **************************************** Descargar imagen ****************************************
router.get("/image/:id/download", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).send("Imagen no encontrada");

    const response = await fetch(image.urlImagen);
    if (response.ok) {
      const buffer = await response.buffer();
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="image-${Date.now()}.jpg"`
      );
      res.setHeader("Content-Type", "image/jpeg");
      res.send(buffer);
    } else {
      throw new Error("No se pudo descargar la imagen remota");
    }
  } catch (error) {
    console.error("Error al descargar imagen:", error);
    res.status(500).send("No se pudo descargar la imagen.");
  }
});

module.exports = router;
