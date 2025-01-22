
const {
  default: weaviate,
} = require("weaviate-ts-client");
const createClient = () => {
  return weaviate.client({
    scheme: envVars.WEVIATE_URL.startsWith("https") ? "https" : "http",
    host: envVars.WEVIATE_URL,
    apiKey: new weaviate.ApiKey(envVars.WEVIATE_API_KEY), // Replace w/ your Weaviate instance API key
    headers: {
      "X-OpenAI-Api-Key": envVars.AI_API_KEY,
    },
  });
};

const openaiClient = new OpenAI({
  apiKey: envVars.AI_API_KEY,
});

const fs = require("fs");
const fsPromises = require("fs").promises;
const pdf_parser = require("pdf-parse");
const mammoth = require("mammoth")
const xlsx = require("xlsx")

const sequelize = require("sequelize");
const { Op } = require("sequelize");
const { v1: uuidv1 } = require("uuid");



// let botApis = require("../botApis")

module.exports = {

  delete_documents: async (req, res) => {
    try {
      let client = createClient();
      const fileIdsToDelete = req.body.file_id;
      const fileName = req.body.file_name;
      let org_id = req.body.org_id || req.user.org_id;
      if (fileIdsToDelete?.length > 0 && fileName?.length > 0) {
        let className = "";
        let findOrg = ""
        if (org_id) {
          findOrg = await organisation_detail.findOne({
            where: {
              id: org_id,
            },
            raw: true,
          });
          findOrg.name = findOrg.name.replace(/\s/g, "_");
          className = `${findOrg.userId}_${findOrg.name}`;
        }
        const docs = await documents.findAll({
          where: {
            file_id: fileIdsToDelete
          }
        });

        const deletePromises = docs.map(doc => helper.deleteFromS3(doc.uid));
        await Promise.all(deletePromises);

        const result = await documents.destroy({
          where: {
            file_id: fileIdsToDelete
          }
        });

        await client.batch
          .objectsBatchDeleter()
          .withClassName(`Global_${className}`)
          .withWhere({
            path: ["title"],
            operator: "ContainsAny",
            valueTextArray: fileName,
          })
          .do();
        return helper.success(res, "Files Deleted sucessfully", {});
      }
      return helper.error(res, "Files not found", {});

    }
    catch (error) {
      console.error('Error deleting documents:', error);
      return helper.error(res, error.message, {});
    }
  },

  edit_document: async (req, res) => {
    try {
      const { file_title, caption, profile, organisation_id, uuid, id, author, about, group_name, extension, is_lock, comment_off, url } = req.body
      let document = Array.isArray(req?.files?.documents)
        ? req?.files?.documents
        : req?.files?.documents ? [req?.files?.documents] : [];

      const currentDateTime = moment().format('DD MMMM YYYY HH:mm:ss')
      const detail = `uploaded by :${req.user.first_name} , date:${currentDateTime}`
      let className = "";
      let decryptAiKey = ""
      let findOrg;
      if (organisation_id) {
        findOrg = await organisation_detail.findOne({
          where: {
            id: organisation_id,
          },
          raw: true,
        });
        findOrg.name = findOrg.name.replace(/\s/g, "_");
        className = `${findOrg.userId}_${findOrg.name}`;
        decryptAiKey = helper.decryptAiKey(findOrg.open_ai_key)
      }

      let getClient = await helper.newClient(decryptAiKey)

      let graphqlQuery = getClient.graphql
        .get()
        .withClassName(`Global_${className}`)
        .withFields("_additional { id } content title group")
        .withWhere({
          path: ["unique_id"],
          operator: "Equal",
          valueString: uuid
        })
      let response = await graphqlQuery.do();

      if (response.data.Get[`Global_${className}`].length > 0) {
        const entries = response.data.Get[`Global_${className}`]
        for (const entry of entries) {
          await getClient.data
            .deleter()
            .withClassName(`Global_${className}`)
            .withId(entry._additional.id)
            .do();

          console.log(`Successfully deleted entry with ID: ${entry._additional.id}`);
        }
        let new_uuid;
        if (document.length > 0) {
          await Promise.all(
            document.map(async (doc) => {
              new_uuid = uuidv1();
              let docName = doc.name;
              new_uuid = `${new_uuid}.${extension}`;
              let conentType = doc.mimetype;
              let saveDocName = `${req.user.id}_${docName}`;
              try {
                await doc.mv("./uploads/" + saveDocName);
                let destination = `./uploads/${saveDocName}`;
                const fileContent = await fsPromises.readFile(destination);
                let uploadDoc = await helper.uploadToS3V3(
                  new_uuid,
                  fileContent,
                  conentType
                );
                await documents.update(
                  {
                    caption: caption,
                    file_title: file_title,
                    name: file_title,
                    about: about,
                    author: author,
                    file_id: uploadDoc,
                    is_lock: is_lock,
                    url: url,
                    comment_off: comment_off,
                    uuid: new_uuid
                  },
                  {
                    where: {
                      id: id
                    }
                  })
                fs.unlinkSync(destination);
              } catch (error) {
                logger.error(error);
                return helper.error(res, error.message, {});
              }
            })
          );
        }
        else {
          await documents.update(
            {
              caption: caption,
              file_title: file_title,
              name: file_title,
              about: about,
              author: author,
              is_lock: is_lock,
              url: url,
              comment_off: comment_off,
              file_id: profile,
            },
            {
              where: {
                id: id
              }
            })
        }

        const comments = await document_comment.findAll({
          attributes: {
            include: [
              [
                sequelize.literal(
                  "(SELECT first_name FROM users where users.id = document_comment.user_id)"
                ),
                "first_name",
              ],
            ],
          },
          where: {
            document_id: id
          },
          raw: true
        })

        let allComments = ""
        for (let item of comments) {
          allComments = allComments + `name:${item.first_name} comment:${item.comment},`
        }

        const fileExtension = profile.split('.').pop().toLowerCase()
        const data = await helper.downloadFromS3(profile)
        const fileBuffer = data;

        let text = `caption - ${caption} ${detail} comments - ${allComments}`;

        if (fileExtension === 'pdf') {
          const pdfData = await pdf_parser(fileBuffer);
          text += ` ${pdfData.text}`;

        } else if (fileExtension === 'docx') {
          const data = await mammoth.extractRawText({ buffer: fileBuffer });
          text += ` ${data.value}`;

        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
          const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            sheetData.forEach((row) => {
              text += row.join(' ') + ' ';
            });
          });

        } else if (fileExtension === 'txt') {
          text += ` ${fileBuffer.toString('utf8')}`;

        } else if (['jpg', 'jpeg', 'png', 'webp', 'csv'].includes(fileExtension)) {
          text = ` This is an image with caption: ${caption} comments - ${allComments} ${detail}`;

        } else if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(fileExtension)) {
          text = ` This is a video with caption: ${caption} comments - ${allComments} ${detail}`;

        } else {
          throw new Error(`Unsupported file extension: ${fileExtension}`);
        }
        await helper.processTextWithOverlap(text, findOrg.chunks, findOrg.overlap, file_title, `${className}`, getClient, fileExtension, author, about, new_uuid || uuid, group_name);
        return helper.success(res, "Caption updated successfully", {});
      }
      return helper.error(res, "No data found", {});
    }
    catch (err) {
      console.log(err, "midemde")
      logger.error(err);
      return helper.error(res, err.message, {});
    }
  },

  add_documents: async (req, res) => {
    try {
      const uploaded = []
      const currentDateTime = moment().format('DD MMMM YYYY HH:mm:ss')
      const detail = `uploaded by:${req.user.first_name} , date:${currentDateTime}`

      let client = createClient();
      let org_id = req.body.organisation_id || req.user.org_id;
      let audioUrl = req.body.audioUrl
      let document = Array.isArray(req?.files?.documents)
        ? req?.files?.documents
        : [req?.files?.documents];
      let thumbnail = req?.files?.thumbnail

      let className = req.user.id;
      let documentIds = [];
      let decryptAiKey = ""
      let findOrg = ""
      if (org_id) {
        findOrg = await organisation_detail.findOne({
          where: {
            id: org_id,
          },
          raw: true,
        });
        findOrg.name = findOrg.name.replace(/\s/g, "_");
        className = `${findOrg.userId}_${findOrg.name}`;
        decryptAiKey = helper.decryptAiKey(findOrg.open_ai_key)
      }
      let getClient = await helper.newClient(decryptAiKey)
      let createClasses = await helper.createWeaviateClasses(className, getClient, findOrg.embedded);
      let uuid;
      await Promise.all(
        document.map(async (doc) => {
          try {
            uuid = uuidv1();
            let docName = doc.name;
            let extension = docName.split(".").pop() || "";
            uuid = `${uuid}.${extension}`;
            let document_title = req.body.file_title || docName;
            let conentType = doc.mimetype;
            let saveDocName = `${req.user.id}_${docName}`;


            await doc.mv("./uploads/" + saveDocName);
            let destination = `./uploads/${saveDocName}`;
            const fileContent = await fsPromises.readFile(destination);
            // let uploadDoc = await helper.uploadToS3(docName, fileContent, conentType);
            let uploadDoc = await helper.uploadToS3V3(
              uuid,
              fileContent,
              conentType
            );

            let thumbnailUrl = ""
            if (thumbnail) {
              let uuidThumb = uuidv1();
              let thumbName = thumbnail.name;
              let extension = thumbName.split(".").pop() || "";
              uuidThumb = `${uuidThumb}.${extension}`;
              let conentType = thumbnail.mimetype;
              let saveDoc = `${req.user.id}_${thumbName}`;
              await thumbnail.mv("./uploads/" + saveDoc);
              let thumbdestination = `./uploads/${saveDoc}`;
              const thumbfileContent = await fsPromises.readFile(thumbdestination);
              thumbnailUrl = await helper.uploadToS3V3(
                uuidThumb,
                thumbfileContent,
                conentType
              );
              fs.unlinkSync(thumbdestination);
            }

            let type = 2
            if (conentType == "application/pdf") {
              type = 1
            }
            // let thumbnailUrl = null;
            // if (conentType === "application/pdf") {
            //   thumbnailUrl = await helper.generatePdfThumbnail(destination, uuid);
            // }
            // console.log(thumbnailUrl,"coned")
            // return
            // } else if (conentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            //   thumbnailUrl = await helper.generateDocxThumbnail(destination, uuid);
            // } else if (conentType === "text/plain") {
            //   thumbnailUrl = await helper.generateTxtThumbnail(destination, uuid);
            // } else if (conentType === "application/vnd.ms-excel" || conentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
            //   thumbnailUrl = await helper.generateXlsxThumbnail(destination, uuid);
            // }
            let addDoc = await documents.create({
              user_id: req.user.id,
              caption: audioUrl ? "Processing..." : req.body.caption || "",
              audio: audioUrl || "",
              file_title: document_title,
              file_type: extension,
              author: req.body.author,
              about: req.body.about,
              url: req.body.url || "",
              is_lock: req.body.is_lock || 0,
              comment_off: req.body.comment_off || 0,
              created_date: req.body.created_date,
              expiry_date: req.body.expiry_date,
              uuid: uuid,
              thumbnail: thumbnailUrl || "",
              org_id: org_id,
              name: document_title,
              file_id: uploadDoc,
              type: type
            });
            documentIds.push(addDoc.dataValues.id)
            document = uploadDoc;
            let obj = {
              Document_name: document_title,
              file_id: document,
            };
            uploaded.push(obj)
          } catch (error) {
            logger.error(error);
            return helper.error(res, error.message, {});
          }
        })
      );

      helper.success(res, "Documents Added successfully", uploaded);

      setImmediate(async () => {
        try {
          let captionText = req.body.caption || ""
          if (audioUrl) {
            captionText = await helper.transcribeAudio(`convertText_${uuidv1()}`, audioUrl);
            if (captionText) {
              await documents.update(
                { caption: captionText },
                {
                  where: {
                    id: {
                      [Op.in]: documentIds
                    }
                  }
                }
              );
              logger.info(`Audio transcription successfully added to documents with IDs: ${documentIds.join(", ")}`);
            }
          }
          let docs = Array.isArray(req.files.documents)
            ? req.files.documents
            : [req.files.documents];
          console.log(docs, "doscs")
          await Promise.all(
            docs.map(async (doc) => {
              let uuid1 = uuidv1();
              let docName = doc.name;
              let extension = docName.split(".").pop() || "";
              uuid1 = `${uuid1}.${extension}`;
              let conentType = doc.mimetype;
              let saveDocName = `${req.user.id}_${docName}`;
              let destination = `./uploads/${saveDocName}`;
              let document_title = req.body.file_title || docName;
              const fileContent = await fsPromises.readFile(destination);

              if (conentType == "application/pdf") {
                const text = `title - ${document_title} detail_description - ${captionText} ${detail} ${(await pdf_parser(fileContent)).text}`;
                const chunkSize = findOrg.chunks;
                const overlapSize = findOrg.overlap
                await helper.processTextWithOverlap(text, chunkSize, overlapSize, document_title, className, getClient, req.body.file_type || extension, req.body.author, req.body.about, uuid);
              } else if (conentType === "docx" || conentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                const data = await mammoth.extractRawText({ path: destination });
                const text = `title - ${document_title} detail_description - ${captionText} ${detail} ${data.value}`;
                const chunkSize = findOrg.chunks;
                const overlapSize = findOrg.overlap
                await helper.processTextWithOverlap(text, chunkSize, overlapSize, document_title, className, getClient, getClient, req.body.file_type || extension, req.body.author, req.body.about, uuid);
              }
              else if (conentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || conentType === "application/vnd.ms-excel") {
                let text = `title - ${document_title} detail_description - ${captionText} ${detail}`;
                const workbook = xlsx.readFile(destination);
                workbook.SheetNames.forEach((sheetName) => {
                  const sheet = workbook.Sheets[sheetName];
                  const sheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
                  sheetData.forEach((row) => {
                    text += row.join(' ');
                  });
                });
                const chunkSize = findOrg.chunks;
                const overlapSize = findOrg.overlap
                await helper.processTextWithOverlap(text, chunkSize, overlapSize, document_title, className, getClient, req.body.file_type || extension, req.body.author, req.body.about, uuid);
              } else if (conentType === "text/plain") {
                let text = `detail_description - ${captionText} ${detail} ${fs.readFileSync(destination, 'utf8')}`;
                const chunkSize = findOrg.chunks;
                const overlapSize = findOrg.overlap
                await helper.processTextWithOverlap(text, chunkSize, overlapSize, document_title, className, getClient, req.body.file_type || extension, req.body.author, req.body.about, uuid);
              } else if (conentType.startsWith("image/") || conentType.startsWith("video/")) {
                let text = conentType.startsWith("image/") ? `This is image with detail_description:${captionText || ""} ${detail}` : `This is video with detail_description:${captionText || ""} ${detail}`;
                const chunkSize = findOrg.chunks;
                const overlapSize = findOrg.overlap
                await helper.processTextWithOverlap(text, chunkSize, overlapSize, document_title, className, getClient, extension, req.body.author, req.body.about, uuid);
              }
              fs.unlinkSync(destination);
            })
          );
        }
        catch (error) {
          logger.error(error);
        }
      })
    } catch (error) {
      logger.error(error);
      return helper.error(res, error.message, {});
    }
  },

  generate_signed_url: async (req, res) => {
    try {
      const { url } = req.body
      let signedUrl;
      const fileKey = helper.extractKey(url)
      if (fileKey) {
        signedUrl = await helper.generatingUrl(fileKey)
        return helper.success(res, "Signed url generated successfully", { signedUrl });
      }
      else {
        return helper.error(res, "Invalid file key", {});
      }
    } catch (error) {
      logger.error(error);
      return helper.error(res, error.message, {});
    }
  },

  document_list: async (req, res) => {
    try {
      const role = await helper.findRole(req.user.id, req.query.organisation_id)
      const organisationId = req.query.organisation_id
      const limitInt = parseInt(req.query.limit) || null;
      const page = (parseInt(req.query.page) - 1) * limitInt;
      const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
      let name = req.query.search || "";
      let groupName = req.query.groupName || "";
      let where = {};
      if (role == 4) {
        let findOrg = await organisation_detail.findOne({
          where: {
            id: organisationId
          },
          raw: true,
        });
        logger.info(findOrg, "===============findOrg");
        let findUser = await helper.getUserById(req.user.id);
        let FindGroups = await groups.findAll({
          where: {
            [Op.and]: [
              {
                members: {
                  [Op.like]: `%${findUser.uniqueName}%`,
                },
              },
            ],
          },
          raw: true,
        });
        let groupArr = [];
        for (let obj of FindGroups) {
          groupArr.push(obj.id);
        }
        where = {
          [Op.or]: [
            {
              user_id: findOrg.userId,
            },
            {
              user_id: req.user.id,
            },
            {
              groupId: groupArr,
            },
          ],
          ...where,
        };
      }


      if (role == 3) {
        let getAllUser = await user.findAll({
          where: {
            admin_id: req.user.id,
          },
          raw: true,
        });
        let allUser = [];
        for (let obj of getAllUser) {
          allUser.push(obj.id);
        }
        where = {
          [Op.or]: [
            {
              user_id: allUser,
            },
            {
              user_id: req.user.id,
            },
            {
              user_id: req.user.admin_id,
              groupName: "",
            },
          ],
          ...where,
        };
      }
      if (groupName) {
        where = {
          ...where,
          [Op.and]: [
            sequelize.where(
              sequelize.literal(
                `(SELECT \`name\` FROM \`groups\` WHERE \`groups\`.id = \`documents\`.groupId)`
              ),
              {
                [Op.like]: `%${groupName}%`,
              }
            ),
          ],
        };
      }
      if (role == 4) {
        let findOrg = await organisation_detail.findOne({
          where: {
            id: req.user.org_id,
          },
          raw: true,
        });
        logger.info(findOrg, "===============findOrg");
        let findUser = await helper.getUserById(req.user.id);
        let FindGroups = await groups.findAll({
          where: {
            [Op.and]: [
              {
                members: {
                  [Op.like]: `%${findUser.uniqueName}%`,
                },
              },
            ],
          },
          raw: true,
        });
        let groupArr = [];
        for (let obj of FindGroups) {
          groupArr.push(obj.id);
        }
        where = {
          [Op.or]: [
            {
              user_id: req.user.id,
            },
            {
              groupId: groupArr,
            },
          ],
          ...where,
        };
      }

      let docCount = await documents.count({
        where: {
          ...where,
          org_id: req.query.organisation_id ? req.query.organisation_id : req.user.org_id,
        },
      });

      let getDocList = await documents.findAll({
        attributes: [
          `id`,
          `user_id`,
          ["name", "Document_name"],
          "groupId",
          `caption`,
          `groupName`,
          `org_id`,
          `file_type`,
          `author`,
          `uuid`,
          `is_lock`,
          `liked_user`,
          `comment_off`,
          `url`,
          `file_title`,
          `thumbnail`,
          `about`,
          `created_date`,
          `expiry_date`,
          `audio`,
          `file_id`,
          `type`,
          `createdAt`,
          `updatedAt`,
          [
            sequelize.literal(
              "(SELECT name from `groups` where `groups`.id=documents.groupId)"
            ),
            "group_name",
          ],
          [
            sequelize.literal(
              "ifNull((SELECT name FROM users where documents.user_id = users.id),'Admin')"
            ),
            "added_by",
          ],
          [
            sequelize.literal(
              "ifNull((SELECT image FROM users where documents.user_id = users.id),'Admin')"
            ),
            "owner_profile",
          ],
        ],
        where: {
          org_id: organisationId,
          type: { [Op.ne]: 6 },
          ...where,

          [Op.and]: [
            {
              [Op.or]: [
                {
                  name: {
                    [Op.like]: `%${name}%`,
                  },
                }
                // {
                //   user_id: req.user.id
                // }
              ],
            }]
        },
        limit: limitInt,
        offset: page,
        order: [["id", "desc"]],
        raw: true,
      });

      let data = {
        total_count: docCount,
        docs: getDocList,
      };

      return helper.success(res, "Document List", data);

    } catch (error) {
      logger.error(error);
      return helper.error(res, error.message, {});
    }
  }
};


