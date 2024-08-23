const express = require('express');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET);
var jwt = require('jsonwebtoken');



const cors = require('cors');
const app = express();
const port = 3000;




// Middleware
app.use(cors());
app.use(express.json());

// SET TOKEN .
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
      return res.status(401).send({ error: true, message: 'Unauthorize access' })
  }
  const token = authorization?.split(' ')[1]
  jwt.verify(token, process.env.ASSESS_SECRET, (err, decoded) => {
      if (err) {
          return res.status(403).send({ error: true, message: 'forbidden user or token has expired' })
      }
      req.decoded = decoded;
      next()
  })
}


// MongoDB Connection
const { MongoClient, ServerApiVersion,ObjectId} = require('mongodb');
//const { ObjectId } = require('mongodb/lib/bson');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@yoga-master.c858d.mongodb.net/?retryWrites=true&w=majority&appName=yoga-master`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Connected to MongoDB!");

    // Initialize collections
    const database = client.db("yoga-master");
    const userCollection = database.collection("user");
    const classesCollection = database.collection("classes");
    const cartCollection = database.collection("cart");
    const paymentCollection = database.collection("payment");
    const enrolledCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");


    app.post('/api/set-token', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ASSESS_SECRET, { expiresIn: '24h' })
      res.send({ token })
  })

  // Verify admin
  const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user.role === 'admin') {
        next()
    }
    else {
        return res.status(401).send({ error: true, message: 'Unauthorize access' })
    }
}

const verifyInstructor = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user.role === 'instructor' || user.role === 'admin') {
        next()
    }
    else {
        return res.status(401).send({ error: true, message: 'Unauthorize access' })
    }
}

////////////define  user routes -> ///////////////////////////////////////////////////////////////////

app.post('/new-user', async (req, res) => {
  const newUser = req.body;

  const result = await userCollection.insertOne(newUser);
  res.send(result);
})

// GET ALL USERS
app.get('/users', async (req, res) => {
  const users = await userCollection.find({}).toArray();
  res.send(users);
})

// GET USER BY ID
app.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const user = await userCollection.findOne(query);
  res.send(user);
})

app.get('/user/:email',verifyJWT, async (req, res) => {
  const email = req.params.email;
  const query = { email: email };
  const result = await userCollection.findOne(query);
  res.send(result);
})


// Delete a user

app.delete('/delete-user/:id', verifyJWT ,verifyAdmin,async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await userCollection.deleteOne(query);
  res.send(result);
})
// UPDATE USER
app.put('/update-user/:id', verifyJWT,verifyAdmin,async (req, res) => {
  const id = req.params.id;
  const updatedUser = req.body;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
      $set: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.option,
          address: updatedUser.address,
          phone: updatedUser.phone,
          about: updatedUser.about,
          photoUrl: updatedUser.photoUrl,
          skills: updatedUser.skills ? updatedUser.skills : null,
      }
  }
  const result = await userCollection.updateOne(filter, updateDoc, options);
  res.send(result);
})




////////////user routes ended  -> ////////////////////////////////////////////////////////////////////



    // Define  class routes ?///////////////////////////////////////////////////////////////
    app.post('/new-class',verifyJWT,verifyInstructor, async (req, res) => {
      try {
        const newClass = req.body;
        const result = await classesCollection.insertOne(newClass);
        res.send(result);
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    //get call
    app.get('/classes',async(req,res)=>{

      const query = { status: "approved" }
      const result=await classesCollection.find().toArray()
      res.send(result);

    })

    app.get('/classes/:email',verifyJWT,verifyInstructor,async(req,res)=>{

const email=req.params.email;
const query={instructorEmail:email};
const result=await classesCollection.find(query).toArray();
res.send(result);
    })

    app.get('/classes-manage',async(req,res)=>{

const result=await classesCollection.find().toArray();
res.send(result);

    })

    app.get('/approved-classes',async(req,res)=>{

      const query = { status: "approved" }
const result=await classesCollection.find(query).toArray();
res.send(result);

    })
// Get single class by id for details page
app.get('/class/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await classesCollection.findOne(query);
  res.send(result);
})

    //put call update the single id 
    app.patch('/change-status/:id',verifyJWT,verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id; // Document ID from URL parameter
        const { status, reason } = req.body; // Status and reason from request body
    
        console.log("Request Body:", req.body); // Log request body for debugging
    
        // if (!status || !reason) {
          // return res.status(400).json({ message: 'Status and reason are required' });
        // }
    
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: status,
            reason: reason,
          },
        };
    
        const result = await classesCollection.updateOne(filter, updateDoc);
    
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Document not found' });
        }
    
        res.json({ message: 'Document updated successfully' });
      } catch (error) {
        res.status(500).json({ message: 'An error occurred', error: error.message });
      }
    });
    
// Update a class
app.put('/update-class/:id',verifyJWT,verifyInstructor, async (req, res) => {
  const id = req.params.id;
  const updatedClass = req.body;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };
  const updateDoc = {
      $set: {
          name: updatedClass.name,
          description: updatedClass.description,
          price: updatedClass.price,
          availableSeats: parseInt(updatedClass.availableSeats),
          videoLink: updatedClass.videoLink,
          status: 'pending'
      }
  }
  const result = await classesCollection.updateOne(filter, updateDoc, options);
  res.send(result);
})

///////////////////////////////////////////////classes routes end ///////////////////////////////////////////////////////////////////

/// cart routes  define ////////////////////////////////////////////////////////////////////********* */

// ADD TO CART
app.post('/add-to-cart', verifyJWT,async (req, res) => {
  const newCartItem = req.body;
  const result = await cartCollection.insertOne(newCartItem);
  res.send(result);
})

// Get cart item id for checking if a class is already in cart
app.get('/cart-item/:id', verifyJWT,async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
  const query = { classId: id, userMail: email };
  const projection = { classId: 1 };
  const result = await cartCollection.findOne(query, { projection: projection });
  res.send(result);
})

//cart infromation by user email
app.get('/cart/:email', verifyJWT,async (req, res) => {
  const email = req.params.email;
  const query = { userMail: email };
  const projection = { classId: 1 };
  const carts = await cartCollection.find(query, { projection: projection }).toArray();
  const classIds = carts.map(cart => new ObjectId(cart.classId));
  const query2 = { _id: { $in: classIds } };
  const result = await classesCollection.find(query2).toArray();
  res.send(result);
})


// Delete a item form cart
app.delete('/delete-cart-item/:id',verifyJWT,async (req, res) => {
  const id = req.params.id;
  const query = { classId: id };
  const result = await cartCollection.deleteOne(query);
  res.send(result);
})



////////////////////////////////////////////////// cart-routes-ends  ////////////////************ ???????///////???////?/// */

////////////////////////////////////////// defined-payment-routes   /////////////////************8********????////////??///////// */

app.post('/create-payment-intent', async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price) * 100;
  const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
  });
  res.send({
      clientSecret: paymentIntent.client_secret
  });
})


// POST PAYMENT INFO 
app.post('/payment-info', verifyJWT,async (req, res) => {
  const paymentInfo = req.body;
  const classesId = paymentInfo.classesId;
  const userEmail = paymentInfo.userEmail;
  const singleClassId = req.query.classId;
  let query;
  // const query = { classId: { $in: classesId } };
  if (singleClassId) {
      query = { classId: singleClassId, userMail: userEmail };
  } else {
      query = { classId: { $in: classesId } };
  }
  const classesQuery = { _id: { $in: classesId.map(id => new ObjectId(id)) } }
  const classes = await classesCollection.find(classesQuery).toArray();
  const newEnrolledData = {
      userEmail: userEmail,
      classesId: classesId.map(id => new ObjectId(id)),
      transactionId: paymentInfo.transactionId,
  }
  const updatedDoc = {
      $set: {
          totalEnrolled: classes.reduce((total, current) => total + current.totalEnrolled, 0) + 1 || 0,
          availableSeats: classes.reduce((total, current) => total + current.availableSeats, 0) - 1 || 0,
      }
  }
  // const updatedInstructor = await userCollection.find()
  const updatedResult = await classesCollection.updateMany(classesQuery, updatedDoc, { upsert: true });
  const enrolledResult = await enrolledCollection.insertOne(newEnrolledData);
  const deletedResult = await cartCollection.deleteMany(query);
  const paymentResult = await paymentCollection.insertOne(paymentInfo);
  res.send({ paymentResult, deletedResult, enrolledResult, updatedResult });
})

// payment history information
app.get('/payment-history/:email', async (req, res) => {
  const email = req.params.email;
  const query = { userEmail: email };
  const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
  res.send(result);
})

//////////////////////////////////////payment-routes-ended ////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////defind-enrolment=routes ///////////////////////////////////////////////////////////////////////////////////

app.get('/popular_classes', async (req, res) => {
  const result = await classesCollection.find().sort({ totalEnrolled: -1 }).limit(6).toArray();
  res.send(result);
})


app.get('/popular-instructors', async (req, res) => {
  const pipeline = [
      {
          $group: {
              _id: "$instructorEmail",
              totalEnrolled: { $sum: "$totalEnrolled" },
          }
      },
      {
          $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "email",
              as: "instructor"
          }
      },
      {
          $project: {
              _id: 0,
              instructor: {
                  $arrayElemAt: ["$instructor", 0]
              },
              totalEnrolled: 1
          }
      },
      {
          $sort: {
              totalEnrolled: -1
          }
      },
      {
          $limit: 6
      }
  ]
  const result = await classesCollection.aggregate(pipeline).toArray();
  res.send(result);

})

///////////////////////////////////////////////////////////////enrolment=routes-ended ///////////////////////////////////////////////////////////

// Admins stats 
app.get('/admin-stats', verifyJWT,verifyAdmin,async (req, res) => {
  // Get approved classes and pending classes and instructors 
  const approvedClasses = (await classesCollection.find({ status: 'approved' }).toArray()).length;
  const pendingClasses = (await classesCollection.find({ status: 'pending' }).toArray()).length;
  const instructors = (await userCollection.find({ role: 'instructor' }).toArray()).length;
  const totalClasses = (await classesCollection.find().toArray()).length;
  const totalEnrolled = (await enrolledCollection.find().toArray()).length;
  // const totalRevenue = await paymentCollection.find().toArray();
  // const totalRevenueAmount = totalRevenue.reduce((total, current) => total + parseInt(current.price), 0);
  const result = {
      approvedClasses,
      pendingClasses,
      instructors,
      totalClasses,
      totalEnrolled,
      // totalRevenueAmount
  }
  res.send(result);

})

//get all instructor 
app.get('/instructors', async (req, res) => {
  const result = await userCollection.find({ role: 'instructor' }).toArray();
  res.send(result);
})

app.get('/enrolled-classes/:email',verifyJWT,async (req, res) => {
  const email = req.params.email;
  const query = { userEmail: email };
  const pipeline = [
      {
          $match: query
      },
      {
          $lookup: {
              from: "classes",
              localField: "classesId",
              foreignField: "_id",
              as: "classes"
          }
      },
      {
          $unwind: "$classes"
      },
      {
          $lookup: {
              from: "users",
              localField: "classes.instructorEmail",
              foreignField: "email",
              as: "instructor"
          }
      },
      {
          $project: {
              _id: 0,
              classes: 1,
              instructor: {
                  $arrayElemAt: ["$instructor", 0]
              }
          }
      }

  ]
  const result = await enrolledCollection.aggregate(pipeline).toArray();
  // const result = await enrolledCollection.find(query).toArray();
  res.send(result);
})


///////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////applied-routes ////////////////////////////////////5555555555/5/5////////

// Applied route 
app.post('/as-instructor', async (req, res) => {
  const data = req.body;
  const result = await appliedCollection.insertOne(data);
  res.send(result);
})
app.get('/applied-instructors/:email',   async (req, res) => {
  const email = req.params.email;
  const result = await appliedCollection.findOne({email});
  res.send(result);
});

    app.listen(port, () => {    

      console.log(`Example app listening on port ${port}`);
    });

  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

run().catch(console.dir);
